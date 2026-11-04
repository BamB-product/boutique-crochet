/* Tunnel de commande : livraison, paiement, confirmation. */
(function () {
  "use strict";
  var M = window.Mailles;
  if (!M) { return; }
  var C = M.config || {};
  var page = document.body.getAttribute("data-page");
  var K_LIV = "mailles-livraison-v1", K_REF = "mailles-ref-v1", K_DER = "mailles-derniere-v1";
  var FRAIS = typeof C.fraisPort === "number" ? C.fraisPort : 5;
  var memoire = {};

  function lireJ(cle) {
    try { var v = window.localStorage.getItem(cle); if (v !== null) { return JSON.parse(v); } } catch (e) { /* repli mémoire */ }
    return memoire[cle] || null;
  }
  function ecrireJ(cle, v) {
    memoire[cle] = v;
    try { window.localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* ignoré */ }
  }
  function effacer(cle) {
    delete memoire[cle];
    try { window.localStorage.removeItem(cle); } catch (e) { /* ignoré */ }
  }
  function $(id) { return document.getElementById(id); }
  function aller(url) { window.location.replace(url); }
  function arrondi(n) { return Math.round(n * 100) / 100; }

  function totaux(liste, mode) {
    var sous = arrondi(liste.reduce(function (t, l) { return t + l.qte * l.prix; }, 0));
    var net = M.apresRemise(sous);
    var remise = arrondi(sous - net);
    var frais = mode === "expedition" ? FRAIS : 0;
    return { sous: sous, remise: remise, frais: frais, total: arrondi(net + frais), code: M.codeActif() };
  }

  function note() { try { return window.localStorage.getItem(M.cleNote) || ""; } catch (e) { return ""; } }

  /* ---------- Récapitulatif (colonne de droite ou confirmation) ---------- */
  function afficherRecap(articles, t, mode) {
    var ul = $("recap-articles");
    if (ul) {
      ul.textContent = "";
      articles.forEach(function (l) {
        var li = document.createElement("li");
        var g = document.createElement("span"); g.className = "ra-nom";
        g.appendChild(M.elt("strong", "", l.qte + " × " + l.produit));
        if (l.options && l.options.length) {
          g.appendChild(M.elt("small", "", l.options.map(function (o) { return o.etiquette + " : " + o.valeur; }).join(" · ")));
        }
        li.appendChild(g);
        li.appendChild(M.elt("span", "ra-prix", M.euros(l.qte * l.prix)));
        ul.appendChild(li);
      });
    }
    var set = function (id, txt) { var e = $(id); if (e) { e.textContent = txt; } };
    set("r-sous-total", M.euros(t.sous));
    var lr = $("r-ligne-remise");
    if (lr) { lr.hidden = !(t.remise > 0); set("r-nom-code", "MILLIE"); set("r-remise", "−" + M.euros(t.remise)); }
    if (mode === "expedition") { set("r-lib-frais", "Expédition"); set("r-frais", M.euros(t.frais)); }
    else if (mode === "retrait") { set("r-lib-frais", "Retrait au marché"); set("r-frais", "Offert"); }
    else { set("r-lib-frais", "Livraison"); set("r-frais", "à choisir"); }
    set("r-total", M.euros(t.total));
  }

  /* ---------- Message de commande ---------- */
  function libelleSamedi(iso) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d); }
    catch (e) { return iso; }
  }
  function adresseTexte(l) {
    return [l.adresse, l.complement, l.cp + " " + l.ville, "France métropolitaine"].filter(Boolean).join("\n");
  }
  function messageCommande(o) {
    var lignes = ["Commande " + o.ref + " : " + o.statut, ""];
    o.articles.forEach(function (l) {
      lignes.push("- " + l.qte + " × " + l.produit + (l.options && l.options.length ? " (" + l.options.map(function (x) { return x.etiquette + " : " + x.valeur; }).join(", ") + ")" : "") + " : " + M.euros(l.qte * l.prix));
    });
    lignes.push("");
    lignes.push("Articles : " + M.euros(o.sous));
    if (o.remise > 0) { lignes.push("Code MILLIE (−5 %) : −" + M.euros(o.remise)); }
    lignes.push(o.mode === "expedition" ? "Expédition : " + M.euros(o.frais) : "Retrait au marché de Lisieux : offert");
    lignes.push("TOTAL : " + M.euros(o.total));
    lignes.push("");
    var l = o.livraison;
    if (o.mode === "retrait") { lignes.push("Retrait : marché de Lisieux, " + libelleSamedi(l.samedi) + ", de 8h à 13h."); }
    else { lignes.push("Livraison à :", l.prenom + " " + l.nom, adresseTexte(l)); }
    lignes.push("", "Client : " + l.prenom + " " + l.nom, "E-mail : " + l.email);
    if (l.tel) { lignes.push("Téléphone : " + l.tel); }
    if (o.note) { lignes.push("", "Précisions : " + o.note); }
    return lignes.join("\n");
  }
  function envoyer(o) {
    if (!C.formEndpoint) { return Promise.resolve(false); }
    var corps = JSON.stringify({
      email: o.livraison.email,
      name: o.livraison.prenom + " " + o.livraison.nom,
      _subject: "Commande " + o.ref + " : " + o.statut,
      message: messageCommande(o)
    });
    var fin = new Promise(function (res) { setTimeout(function () { res(false); }, 9000); });
    var req;
    try {
      req = fetch(C.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: corps })
        .then(function (r) { return r.ok; }, function () { return false; });
    } catch (e) { req = Promise.resolve(false); }
    return Promise.race([req, fin]);
  }

  /* ---------- Étape Livraison ---------- */
  function pageLivraison() {
    var liste = M.lire();
    if (!liste.length) { aller("panier.html"); return; }
    var form = $("form-livraison");
    var mode = function () { return form.querySelector('input[name="mode"]:checked').value; };
    var champs = ["prenom", "nom", "email", "tel", "adresse", "complement", "cp", "ville"];
    var fieldAdresse = $("bloc-adresse"), blocRetrait = $("bloc-retrait"), select = $("samedi");

    // samedis proposés : le premier à au moins 7 jours, puis 5 suivants
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 7);
    while (d.getDay() !== 6) { d.setDate(d.getDate() + 1); }
    for (var i = 0; i < 6; i++) {
      var iso = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      var o = document.createElement("option"); o.value = iso; o.textContent = libelleSamedi(iso);
      select.appendChild(o);
      d.setDate(d.getDate() + 7);
    }

    var stock = lireJ(K_LIV);
    if (stock) {
      champs.forEach(function (c) { if (stock[c] != null) { $(c).value = stock[c]; } });
      var r = form.querySelector('input[name="mode"][value="' + stock.mode + '"]');
      if (r) { r.checked = true; }
      if (stock.samedi) { select.value = stock.samedi; }
    }

    var maj = function () {
      var m = mode();
      fieldAdresse.hidden = m !== "expedition";
      blocRetrait.hidden = m !== "retrait";
      form.querySelectorAll(".mode").forEach(function (l) { l.classList.toggle("actif", l.querySelector("input").checked); });
      afficherRecap(liste, totaux(liste, m), m);
    };
    form.querySelectorAll('input[name="mode"]').forEach(function (r) { r.addEventListener("change", maj); });
    maj();

    var erreur = function (id, msg) {
      var e = $("err-" + id), champ = $(id);
      if (e) { e.textContent = msg; }
      if (champ) { if (msg) { champ.setAttribute("aria-invalid", "true"); champ.setAttribute("aria-describedby", "err-" + id); } else { champ.removeAttribute("aria-invalid"); champ.removeAttribute("aria-describedby"); } }
      return !msg;
    };
    var valider = function () {
      var m = mode(), premier = null;
      var test = function (id, ok, msg) {
        var bon = erreur(id, ok ? "" : msg);
        if (!bon && !premier) { premier = $(id); }
      };
      var v = function (id) { return $(id).value.trim(); };
      test("prenom", v("prenom"), "Indiquez votre prénom.");
      test("nom", v("nom"), "Indiquez votre nom.");
      test("email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email")), "Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.");
      if (v("tel")) { test("tel", /^[0-9 .+()-]{6,20}$/.test(v("tel")), "Ce numéro semble incomplet."); } else { erreur("tel", ""); }
      if (m === "expedition") {
        test("adresse", v("adresse"), "Indiquez le numéro et le nom de la rue.");
        test("cp", /^\d{5}$/.test(v("cp")), "Le code postal comporte 5 chiffres.");
        test("ville", v("ville"), "Indiquez la ville.");
      } else { ["adresse", "cp", "ville"].forEach(function (c) { erreur(c, ""); }); }
      if (m === "retrait") { test("samedi", select.value, "Choisissez un samedi."); }
      if (premier) { premier.focus(); }
      return !premier;
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!valider()) { return; }
      var data = { mode: mode(), samedi: select.value };
      champs.forEach(function (c) { data[c] = $(c).value.trim(); });
      ecrireJ(K_LIV, data);
      aller("paiement.html");
    });
  }

  /* ---------- Étape Paiement ---------- */
  function referenceCommande() {
    var r = lireJ(K_REF);
    if (r) { return r; }
    var n = new Date(), alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) { s += alpha.charAt(Math.floor(Math.random() * alpha.length)); }
    r = "MC-" + String(n.getFullYear()).slice(2) + ("0" + (n.getMonth() + 1)).slice(-2) + ("0" + n.getDate()).slice(-2) + "-" + s;
    ecrireJ(K_REF, r);
    return r;
  }
  function lienPaypal(total) {
    var h = String(C.paypalMe || "").trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/\/.*$/, "");
    if (!h) { return ""; }
    return "https://www.paypal.me/" + encodeURIComponent(h) + "/" + total.toFixed(2) + "EUR";
  }
  function pageResumeLivraison(l, mode, el) {
    el.textContent = "";
    el.appendChild(M.elt("h2", "", mode === "retrait" ? "Retrait au marché" : "Livraison"));
    if (mode === "retrait") {
      el.appendChild(M.elt("p", "", "Marché de Lisieux, " + libelleSamedi(l.samedi) + ", de 8h à 13h."));
    } else {
      adresseTexte(l).split("\n").forEach(function (t, i) { el.appendChild(M.elt("p", "ligne-adresse", (i === 0 ? l.prenom + " " + l.nom + " · " : "") + t)); });
    }
    el.appendChild(M.elt("p", "note", l.email + (l.tel ? " · " + l.tel : "")));
  }
  function pagePaiement() {
    var liste = M.lire(), liv = lireJ(K_LIV);
    if (!liste.length) { aller("panier.html"); return; }
    if (!liv) { aller("livraison.html"); return; }
    var t = totaux(liste, liv.mode);
    afficherRecap(liste, t, liv.mode);
    var ref = referenceCommande();
    $("ref-commande").textContent = ref;
    var bloc = $("resume-livraison");
    pageResumeLivraison(liv, liv.mode, bloc);
    var modifier = document.createElement("a"); modifier.href = "livraison.html"; modifier.textContent = "Modifier"; modifier.className = "modifier";
    bloc.insertBefore(modifier, bloc.firstChild);

    var commande = function (statut) {
      return { ref: ref, statut: statut, articles: liste, sous: t.sous, remise: t.remise, frais: t.frais, total: t.total,
        mode: liv.mode, livraison: liv, note: note(), paypal: !!lienPaypal(t.total), date: new Date().toISOString(), envoye: false };
    };
    var url = lienPaypal(t.total);
    var retour = $("retour-paiement");
    var termine = $("termine");
    var enCours = false;

    var finaliser = function (statut) {
      if (enCours) { return; }
      enCours = true;
      var b = url ? termine : $("envoyer-sans-paypal");
      b.disabled = true; b.textContent = "Enregistrement…";
      var o = commande(statut);
      envoyer(o).then(function (ok) {
        o.envoye = ok;
        ecrireJ(K_DER, o);
        M.ecrire([]);
        effacer(K_LIV); effacer(K_REF);
        try { window.localStorage.removeItem(M.cleNote); } catch (e) { /* ignoré */ }
        aller("confirmation.html");
      });
    };

    if (url) {
      $("montant-paypal").textContent = M.euros(t.total);
      var lp = $("lien-paypal");
      lp.href = url;
      var prevenu = false;
      lp.addEventListener("click", function () {
        if (prevenu || !C.formEndpoint) { return; }
        prevenu = true;
        envoyer(commande("en attente de paiement PayPal"));
        retour.textContent = "Une fois le paiement fait sur PayPal, revenez ici et validez avec le bouton ci-dessous.";
      });
      termine.addEventListener("click", function () { finaliser("paiement PayPal déclaré par le client, à vérifier"); });
    } else {
      $("paypal-actif").hidden = true;
      $("paypal-absent").hidden = false;
      $("envoyer-sans-paypal").addEventListener("click", function () { finaliser("à payer : envoyer un lien PayPal au client"); });
    }
  }

  /* ---------- Étape Confirmation ---------- */
  function pageConfirmation() {
    var o = lireJ(K_DER);
    if (!o) { aller("index.html"); return; }
    $("conf-ref").textContent = o.ref;
    afficherRecap(o.articles, { sous: o.sous, remise: o.remise, frais: o.frais, total: o.total }, o.mode);
    var l = o.livraison;
    var txt = "Merci " + l.prenom + " ! ";
    txt += o.paypal
      ? "Catherine vérifie votre paiement PayPal puis vous écrit à " + l.email + " pour confirmer. "
      : "Catherine vous écrit à " + l.email + " avec un lien PayPal pour régler votre commande. ";
    txt += o.mode === "retrait"
      ? "Rendez-vous au marché de Lisieux le " + libelleSamedi(l.samedi) + ", entre 8h et 13h."
      : "Votre commande est crochetée à la main puis expédiée sous une semaine.";
    $("conf-texte").textContent = txt;
    var zone = $("conf-livraison");
    pageResumeLivraison(l, o.mode, zone);
    if (!o.envoye) {
      $("conf-envoi").hidden = false;
      var msg = messageCommande(o);
      $("conf-message").value = msg;
      $("conf-mail").href = "mailto:" + M.email + "?subject=" + encodeURIComponent("Commande " + o.ref + " : Les Mailles de Catherine") + "&body=" + encodeURIComponent(msg);
      $("conf-copier").addEventListener("click", function () { M.copier(msg, $("retour-copie"), "Message copié. Collez-le dans un e-mail à " + M.email + "."); });
    }
  }

  if (page === "livraison") { pageLivraison(); }
  else if (page === "paiement") { pagePaiement(); }
  else if (page === "confirmation") { pageConfirmation(); }
})();
