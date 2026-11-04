/* Les Mailles de Catherine : menu, galerie, panier et commande par e-mail */
(function () {
  "use strict";
  var CONFIG = window.MAILLES_CONFIG || {};
  var EMAIL = CONFIG.email || "mailles-de-catherine@gmail.com";
  var CLE = "mailles-panier-v1";
  var CLE_NOTE = "mailles-note-v1";

  /* ---------- Toujours arriver en haut de page ---------- */
  if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
  function enHaut() {
    try { document.body.scrollIntoView({ block: "start", behavior: "instant" }); } catch (e) { /* ignoré */ }
    try { window.scrollTo(0, 0); } catch (e) { /* ignoré */ }
  }
  enHaut();
  window.addEventListener("pageshow", enHaut);
  // Dans l'aperçu intégré, la page qui contient le site garde sa position de défilement :
  // on remonte avant de changer de page, pendant le clic, pour que la nouvelle page s'affiche en haut.
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank") { return; }
    var h = a.getAttribute("href") || "";
    if (/^(index|tulipe|marque-page|catherine|commander|panier|livraison|paiement|confirmation|mentions)\.html/.test(h)) { enHaut(); }
  });

  /* ---------- Menu mobile ---------- */
  var bouton = document.getElementById("menu-bouton");
  var nav = document.getElementById("nav");
  if (bouton && nav) {
    bouton.addEventListener("click", function () {
      var ouvert = nav.classList.toggle("ouvert");
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
  }

  /* ---------- Galerie ---------- */
  var principale = document.getElementById("photo-principale");
  var miniatures = document.querySelectorAll(".miniatures button");
  miniatures.forEach(function (b) {
    b.addEventListener("click", function () {
      principale.src = b.getAttribute("data-grande");
      principale.alt = b.getAttribute("data-alt");
      miniatures.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
    });
  });

  /* ---------- Panier : stockage ---------- */
  var enMemoire = [];
  function lire() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (brut) {
        var liste = JSON.parse(brut);
        if (Array.isArray(liste)) { enMemoire = liste; return liste; }
      }
    } catch (e) { /* stockage indisponible : on garde la mémoire de la page */ }
    return enMemoire;
  }
  function ecrire(liste) {
    enMemoire = liste;
    try { window.localStorage.setItem(CLE, JSON.stringify(liste)); } catch (e) { /* ignoré */ }
    majCompteur(false);
  }
  function nbArticles() {
    return lire().reduce(function (n, l) { return n + l.qte; }, 0);
  }
  function majCompteur(animer) {
    var n = nbArticles();
    document.querySelectorAll(".compteur").forEach(function (c) {
      c.textContent = n;
      c.classList.toggle("vide", n === 0);
      c.setAttribute("aria-label", n + (n > 1 ? " articles" : " article") + " dans le panier");
      if (animer) {
        c.classList.remove("bump");
        void c.offsetWidth;
        c.classList.add("bump");
      }
    });
  }
  function euros(n) {
    n = Math.round(n * 100) / 100;
    var entier = Math.abs(n - Math.round(n)) < 0.001;
    return n.toLocaleString("fr-FR", { minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2 }) + " €";
  }

  /* ---------- Code promo ---------- */
  var CLE_PROMO = "mailles-promo-v1";
  var CODE_VALIDE = "MILLIE";
  var TAUX = 0.05;
  var promoMemoire = "";
  function codeActif() {
    try {
      var c = window.localStorage.getItem(CLE_PROMO);
      if (c !== null) { promoMemoire = c; }
    } catch (e) { /* stockage indisponible */ }
    return promoMemoire === CODE_VALIDE ? CODE_VALIDE : "";
  }
  function taux() { return codeActif() ? TAUX : 0; }
  function ecrireCode(c) {
    promoMemoire = c;
    try {
      if (c) { window.localStorage.setItem(CLE_PROMO, c); } else { window.localStorage.removeItem(CLE_PROMO); }
    } catch (e) { /* ignoré */ }
  }
  function apresRemise(m) { return Math.round(m * (1 - taux()) * 100) / 100; }
  function lecteur(texte) {
    var sr = document.createElement("span"); sr.className = "sr"; sr.textContent = texte; return sr;
  }
  // Écrit un prix : seul si pas de code, sinon ancien prix barré + nouveau prix
  function ecrirePrix(el, m) {
    el.textContent = "";
    if (!taux()) { el.textContent = euros(m); return; }
    var avant = document.createElement("s"); avant.className = "avant";
    avant.appendChild(lecteur("Prix avant remise : ")); avant.appendChild(document.createTextNode(euros(m)));
    var apres = document.createElement("span"); apres.className = "apres";
    apres.appendChild(lecteur("Prix après remise : ")); apres.appendChild(document.createTextNode(euros(apresRemise(m))));
    el.appendChild(avant); el.appendChild(document.createTextNode(" ")); el.appendChild(apres);
  }
  function majPrixStatiques() {
    document.querySelectorAll("[data-montant]").forEach(function (el) {
      ecrirePrix(el, parseFloat(el.getAttribute("data-montant")));
    });
  }
  function majBandeau() {
    var ancien = document.getElementById("bandeau-promo");
    if (ancien && ancien.parentNode) { ancien.parentNode.removeChild(ancien); }
    if (!taux() || document.body.hasAttribute("data-tunnel")) { return; }
    var entete = document.querySelector(".entete");
    if (!entete) { return; }
    var b = document.createElement("div"); b.className = "bandeau-promo"; b.id = "bandeau-promo";
    var w = document.createElement("div"); w.className = "wrap";
    w.appendChild(document.createTextNode("Merci d'avoir trouvé Millie ! Le code " + CODE_VALIDE + " est actif : 5 % de réduction sur toutes vos créations. "));
    var a = document.createElement("a"); a.href = "panier.html"; a.textContent = "Voir mon panier";
    w.appendChild(a);
    b.appendChild(w);
    entete.parentNode.insertBefore(b, entete.nextSibling);
  }
  function bornes(q) { return Math.max(1, Math.min(20, parseInt(q, 10) || 1)); }

  /* ---------- Copie dans le presse-papiers (avec repli) ---------- */
  function copier(texte, zone, message) {
    function ok() { if (zone) { zone.textContent = message; } }
    function repli() {
      var t = document.createElement("textarea");
      t.value = texte; t.setAttribute("readonly", "");
      t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); ok(); } catch (e) {
        if (zone) { zone.textContent = "Copie impossible, sélectionnez le texte à la main."; }
      }
      document.body.removeChild(t);
    }
    try { navigator.clipboard.writeText(texte).then(ok, repli); } catch (e) { repli(); }
  }

  var retourCopie = document.getElementById("retour-copie");
  var boutonAdresse = document.getElementById("copier-adresse");
  if (boutonAdresse) {
    boutonAdresse.addEventListener("click", function () { copier(EMAIL, retourCopie, "Adresse copiée."); });
  }

  /* ---------- Confirmation d'ajout dans l'en-tête ---------- */
  var minuteur = null;
  function fermerLayer() {
    var l = document.getElementById("ajout-layer");
    if (l && l.parentNode) { l.parentNode.removeChild(l); }
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
  }
  function armerMinuteur(l) {
    if (minuteur) { clearTimeout(minuteur); }
    minuteur = setTimeout(fermerLayer, 7000);
    l.onmouseenter = function () { clearTimeout(minuteur); };
    l.onmouseleave = function () { armerMinuteur(l); };
    l.onfocusin = function () { clearTimeout(minuteur); };
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { fermerLayer(); } });
  function elt(nom, classe, texte) {
    var x = document.createElement(nom);
    if (classe) { x.className = classe; }
    if (texte) { x.textContent = texte; }
    return x;
  }
  function afficherAjout(q, produit, image, opts) {
    var entete = document.querySelector(".entete");
    if (!entete) { return; }
    fermerLayer();
    var n = nbArticles();
    var somme = lire().reduce(function (t, l) { return t + l.qte * l.prix; }, 0);
    var l = elt("div", "ajout-layer"); l.id = "ajout-layer"; l.setAttribute("role", "status");
    var tete = elt("div", "ajout-tete");
    var coche = elt("span", "coche", "✓"); coche.setAttribute("aria-hidden", "true");
    var fermer = elt("button", "fermer", "×"); fermer.type = "button"; fermer.setAttribute("aria-label", "Fermer");
    fermer.addEventListener("click", fermerLayer);
    tete.appendChild(coche); tete.appendChild(elt("strong", "", "Ajouté au panier")); tete.appendChild(fermer);
    var corps = elt("div", "ajout-corps");
    var img = elt("img"); img.src = image; img.alt = ""; img.width = 58; img.height = 58;
    var txt = elt("div");
    txt.appendChild(elt("p", "a-nom", q + " × " + produit));
    txt.appendChild(elt("p", "a-det", opts.map(function (o) {
      var nom = o.etiquette === "Couleur de la fleur" ? "Fleur" : (o.etiquette === "Couleur du pot" ? "Pot" : o.etiquette);
      return nom + " : " + o.valeur;
    }).join(" · ")));
    corps.appendChild(img); corps.appendChild(txt);
    var tot = elt("p", "a-total");
    tot.appendChild(document.createTextNode("Votre panier : " + n + (n > 1 ? " articles" : " article") + " · "));
    var st = elt("strong"); ecrirePrix(st, somme); tot.appendChild(st);
    var actions = elt("div", "a-actions");
    var voir = elt("a", "bouton petit", "Voir le panier"); voir.href = "panier.html";
    var suite = elt("button", "bouton petit clair", "Continuer mes achats"); suite.type = "button";
    suite.addEventListener("click", fermerLayer);
    actions.appendChild(voir); actions.appendChild(suite);
    l.appendChild(tete); l.appendChild(corps); l.appendChild(tot); l.appendChild(actions);
    entete.appendChild(l);
    armerMinuteur(l);
  }

  /* ---------- Fiche produit : ajouter au panier ---------- */
  var form = document.getElementById("commande");
  if (form) {
    var produit = form.getAttribute("data-produit");
    var prix = parseFloat(form.getAttribute("data-prix"));
    var image = form.getAttribute("data-image");
    var qte = document.getElementById("quantite");
    var totalMontant = document.getElementById("total-montant");
    var retourAjout = document.getElementById("retour-ajout");

    var choix = function (nom) {
      var c = form.querySelector('input[name="' + nom + '"]:checked');
      return c ? c.value : "";
    };
    var options = function () {
      var res = [];
      form.querySelectorAll("fieldset[data-groupe]").forEach(function (g) {
        res.push({ etiquette: g.getAttribute("data-etiquette"), valeur: choix(g.getAttribute("data-groupe")) });
      });
      return res;
    };
    var visuel = document.getElementById("apercu-visuel");
    var legende = document.getElementById("apercu-legende");
    var photo = document.getElementById("apercu-photo");
    var deja = {};
    var derniere = "";
    var slug = function (t) {
      return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    };
    var srcApercu = function (f, pt) { return "img/tulipe-apercu/" + slug(f) + "-" + slug(pt) + ".webp"; };
    var precharger = function (src) {
      if (!deja[src]) { var i = new Image(); i.src = src; deja[src] = i; }
    };
    var valeurs = function (nom) {
      var r = [];
      form.querySelectorAll('input[name="' + nom + '"]').forEach(function (i) { r.push(i.value); });
      return r;
    };
    var majPhoto = function () {
      if (!photo) { return; }
      var f = choix("fleur"), pt = choix("pot");
      var src = srcApercu(f, pt);
      derniere = src;
      var cible = deja[src] || (deja[src] = new Image());
      var appliquer = function () { if (derniere === src) { photo.src = src; } };
      if (cible.complete && cible.naturalWidth) { appliquer(); }
      else { cible.onload = appliquer; if (!cible.src) { cible.src = src; } }
      photo.alt = "Votre tulipe : fleur " + f + ", pot " + pt;
      // on prépare les variantes voisines pour que le changement soit instantané
      setTimeout(function () {
        valeurs("fleur").forEach(function (v) { precharger(srcApercu(v, pt)); });
        valeurs("pot").forEach(function (v) { precharger(srcApercu(f, v)); });
      }, 250);
    };
    var majFiche = function () {
      form.querySelectorAll("fieldset[data-groupe]").forEach(function (g) {
        var nom = g.getAttribute("data-groupe");
        var span = g.querySelector(".choix");
        if (span) { span.textContent = choix(nom); }
        var coche = g.querySelector('input[name="' + nom + '"]:checked');
        if (visuel && coche) {
          var rond = coche.parentNode.querySelector(".rond");
          if (rond) { visuel.style.setProperty("--c-" + nom, rond.style.backgroundColor); }
        }
      });
      if (visuel && legende) {
        if (visuel.getAttribute("data-type") === "tulipe") {
          legende.textContent = "Votre tulipe : fleur " + choix("fleur") + ", pot " + choix("pot");
        } else {
          legende.textContent = "Votre marque-page : " + choix("couleur");
        }
      }
      majPhoto();
      ecrirePrix(totalMontant, bornes(qte.value) * prix);
    };
    form.addEventListener("change", majFiche);
    form.addEventListener("input", majFiche);
    document.getElementById("moins").addEventListener("click", function () { qte.value = bornes(qte.value) - 1 || 1; majFiche(); });
    document.getElementById("plus").addEventListener("click", function () { qte.value = Math.min(20, bornes(qte.value) + 1); majFiche(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = bornes(qte.value);
      var opts = options();
      var id = produit + "|" + opts.map(function (o) { return o.valeur; }).join("|");
      var liste = lire().slice();
      var existante = null;
      liste.forEach(function (l) { if (l.id === id) { existante = l; } });
      if (existante) { existante.qte = Math.min(20, existante.qte + q); }
      else { liste.push({ id: id, produit: produit, prix: prix, image: image, options: opts, qte: q }); }
      ecrire(liste);
      majCompteur(true);
      afficherAjout(q, produit, image, opts);
      var texte = q + " × " + produit + " ajouté" + (q > 1 ? "s" : "") + " au panier. ";
      retourAjout.textContent = "";
      retourAjout.appendChild(document.createTextNode(texte));
      var a = document.createElement("a");
      a.href = "panier.html"; a.textContent = "Voir le panier";
      retourAjout.appendChild(a);
    });
    majFiche();
  }

  /* ---------- Page panier ---------- */
  var zoneLignes = document.getElementById("lignes");
  if (zoneLignes) {
    var vide = document.getElementById("panier-vide");
    var contenu = document.getElementById("panier-contenu");
    var note = document.getElementById("note-commande");
    var totalPanier = document.getElementById("total-panier");
    var sousTotal = document.getElementById("sous-total");
    var ligneRemise = document.getElementById("ligne-remise");
    var montantRemise = document.getElementById("montant-remise");
    var nomCode = document.getElementById("nom-code");
    var formPromo = document.getElementById("form-promo");
    var champCode = document.getElementById("code-promo");
    var retourPromo = document.getElementById("promo-retour");
    var retirerCode = document.getElementById("retirer-code");

    var dessiner = function () {
      var liste = lire();
      zoneLignes.textContent = "";
      var videAffiche = liste.length === 0;
      vide.hidden = !videAffiche;
      contenu.hidden = videAffiche;
      if (videAffiche) { majCompteur(); return; }
      var somme = 0;
      liste.forEach(function (it, idx) {
        somme += it.qte * it.prix;
        var li = document.createElement("li"); li.className = "ligne-panier";
        var img = document.createElement("img"); img.src = it.image; img.alt = ""; img.width = 96; img.height = 96;
        var corps = document.createElement("div"); corps.className = "ligne-corps";
        var h = document.createElement("h3"); h.textContent = it.produit;
        var det = document.createElement("p"); det.className = "ligne-details";
        det.textContent = it.options.map(function (o) { return o.etiquette + " : " + o.valeur; }).join(" · ");
        var unit = document.createElement("p"); unit.className = "ligne-unit";
        var pu = document.createElement("span"); ecrirePrix(pu, it.prix);
        unit.appendChild(pu); unit.appendChild(document.createTextNode(" l'unité"));
        corps.appendChild(h); corps.appendChild(det); corps.appendChild(unit);

        var droite = document.createElement("div"); droite.className = "ligne-droite";
        var q = document.createElement("div"); q.className = "qte";
        var moins = document.createElement("button"); moins.type = "button"; moins.textContent = "−";
        moins.setAttribute("aria-label", "Retirer un exemplaire : " + it.produit + ", " + det.textContent);
        var champ = document.createElement("input"); champ.type = "number"; champ.min = "1"; champ.max = "20"; champ.value = it.qte;
        champ.setAttribute("inputmode", "numeric"); champ.id = "qte-" + idx;
        champ.setAttribute("aria-label", "Quantité : " + it.produit + ", " + det.textContent);
        var plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+";
        plus.setAttribute("aria-label", "Ajouter un exemplaire : " + it.produit + ", " + det.textContent);
        q.appendChild(moins); q.appendChild(champ); q.appendChild(plus);
        var tl = document.createElement("strong"); tl.className = "ligne-total"; ecrirePrix(tl, it.qte * it.prix);
        var ret = document.createElement("button"); ret.type = "button"; ret.className = "lien-retirer"; ret.textContent = "Retirer";
        ret.setAttribute("aria-label", "Retirer du panier : " + it.produit + ", " + det.textContent);
        droite.appendChild(q); droite.appendChild(tl); droite.appendChild(ret);

        var changer = function (n) {
          var l2 = lire().slice(); l2[idx] = Object.assign({}, l2[idx], { qte: bornes(n) }); ecrire(l2); dessiner();
        };
        moins.addEventListener("click", function () { changer(it.qte - 1); });
        plus.addEventListener("click", function () { changer(it.qte + 1); });
        champ.addEventListener("change", function () { changer(champ.value); });
        ret.addEventListener("click", function () {
          var l2 = lire().slice(); l2.splice(idx, 1); ecrire(l2); dessiner();
        });
        li.appendChild(img); li.appendChild(corps); li.appendChild(droite);
        zoneLignes.appendChild(li);
      });
      ecrirePrix(sousTotal, somme);
      ecrirePrix(totalPanier, somme);
      var actif = codeActif();
      ligneRemise.hidden = !actif;
      if (actif) { nomCode.textContent = actif; montantRemise.textContent = "−" + euros(somme - apresRemise(somme)); }
      retirerCode.hidden = !actif;
    };

    formPromo.addEventListener("submit", function (e) {
      e.preventDefault();
      var saisi = champCode.value.trim().toUpperCase();
      retourPromo.className = "promo-retour";
      if (!saisi) { retourPromo.textContent = "Saisissez un code."; retourPromo.classList.add("erreur"); return; }
      if (saisi === CODE_VALIDE) {
        ecrireCode(CODE_VALIDE);
        champCode.value = "";
        dessiner();
        retourPromo.textContent = "Bravo, vous connaissez Millie ! Code " + CODE_VALIDE + " appliqué : 5 % de réduction.";
        retourPromo.classList.add("succes");
      } else {
        retourPromo.textContent = "Ce code n'est pas valide. Vérifiez son orthographe.";
        retourPromo.classList.add("erreur");
      }
    });
    retirerCode.addEventListener("click", function () {
      ecrireCode("");
      dessiner();
      retourPromo.className = "promo-retour";
      retourPromo.textContent = "Code retiré.";
    });
    try { var noteStockee = window.localStorage.getItem(CLE_NOTE); if (noteStockee) { note.value = noteStockee; } } catch (e) { /* ignoré */ }
    note.addEventListener("input", function () {
      try { window.localStorage.setItem(CLE_NOTE, note.value); } catch (e) { /* ignoré */ }
    });
    document.getElementById("vider").addEventListener("click", function () { ecrire([]); dessiner(); });
    dessiner();
  }

  majCompteur();
  majPrixStatiques();
  majBandeau();

  window.Mailles = {
    config: CONFIG, email: EMAIL, cleNote: CLE_NOTE,
    lire: lire, ecrire: ecrire, euros: euros, ecrirePrix: ecrirePrix,
    taux: taux, codeActif: codeActif, apresRemise: apresRemise,
    majCompteur: majCompteur, copier: copier, elt: elt
  };
})();
