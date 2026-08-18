// 1️⃣ Définir les éléments AVANT Firebase
const tableau = document.getElementById("monTableau");
const bouton = document.getElementById("ajouter");
const boutonEnregistrer = document.getElementById("enregistrer");
const boutonSupprimer = document.getElementById("supprimer");
const boutonToggleCheck = document.getElementById("toggleCheck");

// 🔢 Fonctions de formatage
function formatNombre(n) {
  return Number(n).toLocaleString("fr-FR");
}

function nettoyerNombre(n) {
  return n.replace(/\s/g, "");
}

// Convertir une date FR → ISO
function convertirDateFRversISO(dateFR) {
  const [date, heure] = dateFR.split(" ");
  const [jour, mois, annee] = date.split("/");
  return `${annee}-${mois}-${jour}T${heure}`;
}

// Convertir ISO → FR
function formatDateAffichage(dateISO) {
  const d = new Date(dateISO);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR");
}

// 🔍 Vérification de cohérence kilométrique
function verifierCoherenceKilometrage() {
  const lignes = [];

  for (let i = 1; i < tableau.rows.length; i++) {
    const cells = tableau.rows[i].cells;

    const dateISO = cells[1].dataset.iso;
    const date = new Date(dateISO);
    const km = Number(cells[4].textContent.replace(/\s/g, ""));

    lignes.push({
      index: i,
      date: date,
      km: km
    });
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligneA = lignes[i];
    let incoherent = false;

    for (let j = 0; j < lignes.length; j++) {
      if (i === j) continue;

      const ligneB = lignes[j];

      if (ligneB.date < ligneA.date && ligneB.km > ligneA.km) {
        incoherent = true;
        break;
      }
    }

    const row = tableau.rows[ligneA.index];
    row.style.backgroundColor = incoherent ? "#ffdddd" : "";
  }
}

// 🔄 2️⃣ Charger les données depuis Firebase
db.ref("journal").on("value", snapshot => {
  const lignes = snapshot.val();

  while (tableau.rows.length > 1) {
    tableau.deleteRow(1);
  }

  if (!lignes) return;

  for (let ligne of lignes) {
    const row = tableau.insertRow();

    // Colonne 1 : Témoin de suppression
    const c0 = row.insertCell();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = ligne.checked === true;
    c0.appendChild(checkbox);

    // Colonne 2 : Date & Heure (modifiable)
    const c1 = row.insertCell();
    c1.textContent = formatDateAffichage(ligne.dateISO);
    c1.dataset.iso = ligne.dateISO;
    c1.contentEditable = true;

    // Colonne 3 : Type de recharge
    const c2 = row.insertCell();

    const select = document.createElement("select");
    const options = ["Maison", "Travail", "Borne public", "Supercharger", "Autre (texte libre)"];

    for (let opt of options) {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    }

    const inputLibre = document.createElement("input");
    inputLibre.type = "text";
    inputLibre.placeholder = "Saisir un type...";
    inputLibre.style.marginLeft = "10px";

    if (!options.includes(ligne.type)) {
      select.value = "Autre (texte libre)";
      inputLibre.value = ligne.type;
      inputLibre.style.display = "inline-block";
    } else {
      select.value = ligne.type;
      inputLibre.style.display = "none";
    }

    select.addEventListener("change", () => {
      if (select.value === "Autre (texte libre)") {
        inputLibre.style.display = "inline-block";
      } else {
        inputLibre.style.display = "none";
        inputLibre.value = "";
      }
    });

    c2.appendChild(select);
    c2.appendChild(inputLibre);

    // Colonne 4 : Consommation
    const c3 = row.insertCell();
    c3.textContent = formatNombre(ligne.conso);
    c3.contentEditable = true;

    // Colonne 5 : Kilométrage
    const c4 = row.insertCell();
    c4.textContent = formatNombre(ligne.km);
    c4.contentEditable = true;

    // Colonne 6 : Enregistré
    const c5 = row.insertCell();

    const selectFlag = document.createElement("select");

    const opt1 = document.createElement("option");
    opt1.value = "❌";
    opt1.textContent = "❌";

    const opt2 = document.createElement("option");
    opt2.value = "✔️";
    opt2.textContent = "✔️";

    selectFlag.appendChild(opt1);
    selectFlag.appendChild(opt2);

    selectFlag.value = ligne.flag || "❌";

    c5.appendChild(selectFlag);
  }

  verifierCoherenceKilometrage();
});

// ➕ 3️⃣ Ajouter une ligne
function ajouterLigne() {
  const maintenantISO = new Date().toISOString();

  const nouvelleLigne = {
    checked: false,
    dateISO: maintenantISO,
    type: "Maison",
    conso: "0",
    km: "0",
    flag: "❌"
  };

  db.ref("journal").once("value", snapshot => {
    const data = snapshot.val() || [];
    data.push(nouvelleLigne);
    db.ref("journal").set(data);
  });
}

bouton.addEventListener("click", ajouterLigne);

// 💾 4️⃣ Enregistrer toutes les lignes (tri par date ISO)
boutonEnregistrer.addEventListener("click", () => {
  let lignes = [];

  for (let i = 1; i < tableau.rows.length; i++) {
    const cells = tableau.rows[i].cells;

    const checkbox = cells[0].querySelector("input");

    const dateFR = cells[1].textContent.trim();
    const dateISO = convertirDateFRversISO(dateFR);

    const select = cells[2].querySelector("select");
    const inputLibre = cells[2].querySelector("input");

    let typeRecharge = select.value;

    if (select.value === "Autre (texte libre)" && inputLibre.value.trim() !== "") {
      typeRecharge = inputLibre.value.trim();
    }

    const selectFlag = cells[5].querySelector("select");

    lignes.push({
      checked: checkbox.checked,
      dateISO: dateISO,
      type: typeRecharge,
      conso: nettoyerNombre(cells[3].textContent),
      km: nettoyerNombre(cells[4].textContent),
      flag: selectFlag.value
    });
  }

  // TRI PAR DATE ISO
  lignes.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

  db.ref("journal").set(lignes);

  verifierCoherenceKilometrage();

  alert("Données enregistrées dans le cloud !");
});

// 🗑️ 5️⃣ Supprimer les lignes cochées
boutonSupprimer.addEventListener("click", () => {

  const confirmation = confirm("Supprimer les lignes cochées ?\n\nRépondre : Oui / Non");

  if (!confirmation) {
    alert("Suppression annulée.");
    return;
  }

  db.ref("journal").once("value", snapshot => {
    const data = snapshot.val() || [];

    const lignesCochees = [];
    for (let i = 1; i < tableau.rows.length; i++) {
      const checkbox = tableau.rows[i].cells[0].querySelector("input");
      if (checkbox.checked) {
        lignesCochees.push(i - 1);
      }
    }

    const nouvellesDonnees = data.filter((ligne, index) => !lignesCochees.includes(index));

    db.ref("journal").set(nouvellesDonnees);

    alert("Lignes supprimées !");
  });
});

// 🆕 Bouton : Cocher / Décocher toutes les cases de la première colonne
boutonToggleCheck.addEventListener("click", () => {
  let auMoinsUneDecochee = false;

  // Vérifier si au moins une case est décochée
  for (let i = 1; i < tableau.rows.length; i++) {
    const checkbox = tableau.rows[i].cells[0].querySelector("input");
    if (!checkbox.checked) {
      auMoinsUneDecochee = true;
      break;
    }
  }

  // Si au moins une est décochée → tout cocher
  // Sinon → tout décocher
  for (let i = 1; i < tableau.rows.length; i++) {
    const checkbox = tableau.rows[i].cells[0].querySelector("input");
    checkbox.checked = auMoinsUneDecochee;
  }

  // Mise à jour du texte du bouton
  boutonToggleCheck.textContent = auMoinsUneDecochee
    ? "Tout décocher"
    : "Tout cocher";
});
