/* ============================================================
   UTILITAIRES
   ============================================================ */

function formatNombre(n) {
  return Number(n).toLocaleString("fr-FR");
}

function nettoyerNombre(n) {
  return n.replace(/\s/g, "");
}

function convertirDateFRversISO(dateFR) {
  const [date, heure] = dateFR.split(" ");
  if (!date || !heure) return null;

  const [jour, mois, annee] = date.split("/");
  if (!jour || !mois || !annee) return null;

  const iso = `${annee}-${mois}-${jour}T${heure}:00`;
  const d = new Date(iso);

  return isNaN(d.getTime()) ? null : iso;
}

function formatDateAffichage(dateISO) {
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR");
}

/* ============================================================
   ELEMENTS DOM
   ============================================================ */

const tableau = document.getElementById("monTableau");
const boutonAjouter = document.getElementById("ajouter");
const boutonEnregistrer = document.getElementById("enregistrer");
const boutonSupprimer = document.getElementById("supprimer");
const boutonToggleCheck = document.getElementById("toggleCheck");

/* ============================================================
   GRAPHIQUE
   ============================================================ */

let graphKm = null;

function mettreAJourGraphique() {
  const points = [];

  for (let i = 1; i < tableau.rows.length; i++) {
    const cells = tableau.rows[i].cells;

    const iso = cells[1].dataset.iso;
    if (!iso) continue;

    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;

    const km = Number(cells[4].textContent.replace(/\s/g, ""));
    points.push({ x: d, y: km });
  }

  const ctx = document.getElementById("graphKm").getContext("2d");

  if (graphKm) graphKm.destroy();
  if (points.length === 0) return;

  graphKm = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: "Kilométrage (km)",
        data: points,
        borderColor: "#4a6cf7",
        backgroundColor: "rgba(74,108,247,0.15)",
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#4a6cf7"
      }]
    },
    options: {
      responsive: true,
      parsing: false,
      scales: {
        x: {
          type: "time",
          min: points[0].x,
          max: points[points.length - 1].x,
          time: {
            tooltipFormat: "dd/MM/yyyy HH:mm",
            displayFormats: {
              hour: "dd/MM HH:mm",
              day: "dd/MM",
              month: "MM/yyyy"
            }
          }
        },
        y: {
          title: { display: true, text: "Kilométrage (km)" }
        }
      }
    }
  });
}

/* ============================================================
   VALIDATION DU COÛT
   ============================================================ */

function validerCout(cell) {
  const valeur = cell.textContent.trim().replace(",", ".");
  const estNombre = !isNaN(valeur) && valeur !== "";
  cell.style.color = estNombre ? "#333" : "red";
}

/* ============================================================
   CHARGEMENT FIREBASE
   ============================================================ */

db.ref("journal").on("value", snapshot => {
  const lignes = snapshot.val();

  while (tableau.rows.length > 1) {
    tableau.deleteRow(1);
  }

  if (!lignes) {
    mettreAJourGraphique();
    return;
  }

  for (let ligne of lignes) {
    const row = tableau.insertRow();

    /* Colonne 1 : suppression */
    const c0 = row.insertCell();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = ligne.checked === true;
    c0.appendChild(checkbox);

    /* Colonne 2 : date */
    const c1 = row.insertCell();
    c1.dataset.iso = ligne.dateISO;
    c1.textContent = formatDateAffichage(ligne.dateISO);
    c1.contentEditable = true;

    /* Colonne 3 : type recharge */
    const c2 = row.insertCell();
    const select = document.createElement("select");
    const options = ["Maison", "Travail", "Borne public", "Supercharger", "Autre (texte libre)"];

    for (let opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
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
      inputLibre.style.display = select.value === "Autre (texte libre)" ? "inline-block" : "none";
      if (select.value !== "Autre (texte libre)") inputLibre.value = "";
    });

    c2.appendChild(select);
    c2.appendChild(inputLibre);

    /* Colonne 4 : conso */
    const c3 = row.insertCell();
    c3.textContent = formatNombre(ligne.conso);
    c3.contentEditable = true;

    /* Colonne 5 : km */
    const c4 = row.insertCell();
    c4.textContent = formatNombre(ligne.km);
    c4.contentEditable = true;

    /* Colonne 6 : coût */
    const c5 = row.insertCell();
    c5.textContent = ligne.cout ? formatNombre(ligne.cout) : "";
    c5.dataset.type = "cout";
    c5.contentEditable = true;
    validerCout(c5);

    /* Colonne 7 : flag */
    const c6 = row.insertCell();
    const selectFlag = document.createElement("select");
    selectFlag.innerHTML = `<option value="❌">❌</option><option value="✔️">✔️</option>`;
    selectFlag.value = ligne.flag || "❌";
    c6.appendChild(selectFlag);
  }

  mettreAJourGraphique();
});

/* ============================================================
   AJOUTER UNE LIGNE
   ============================================================ */

boutonAjouter.addEventListener("click", () => {
  const nouvelle = {
    checked: false,
    dateISO: new Date().toISOString(),
    type: "Maison",
    conso: "0",
    km: "0",
    cout: "0",
    flag: "❌"
  };

  db.ref("journal").once("value", snap => {
    const data = snap.val() || [];
    data.push(nouvelle);
    db.ref("journal").set(data);
  });
});

/* ============================================================
   ENREGISTRER
   ============================================================ */

boutonEnregistrer.addEventListener("click", () => {
  const lignes = [];

  for (let i = 1; i < tableau.rows.length; i++) {
    const cells = tableau.rows[i].cells;

    const checkbox = cells[0].querySelector("input");

    const dateFR = cells[1].textContent.trim();
    const iso = convertirDateFRversISO(dateFR);
    if (!iso) continue;

    const select = cells[2].querySelector("select");
    const inputLibre = cells[2].querySelector("input");

    let typeRecharge = select.value;
    if (select.value === "Autre (texte libre)" && inputLibre.value.trim() !== "") {
      typeRecharge = inputLibre.value.trim();
    }

    const selectFlag = cells[6].querySelector("select");

    lignes.push({
      checked: checkbox.checked,
      dateISO: iso,
      type: typeRecharge,
      conso: nettoyerNombre(cells[3].textContent),
      km: nettoyerNombre(cells[4].textContent),
      cout: nettoyerNombre(cells[5].textContent),
      flag: selectFlag.value
    });
  }

  lignes.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

  db.ref("journal").set(lignes);

  mettreAJourGraphique();
});

/* ============================================================
   SUPPRIMER
   ============================================================ */

boutonSupprimer.addEventListener("click", () => {
  if (!confirm("Supprimer les lignes cochées ?")) return;

  db.ref("journal").once("value", snap => {
    const data = snap.val() || [];

    const indices = [];
    for (let i = 1; i < tableau.rows.length; i++) {
      const checkbox = tableau.rows[i].cells[0].querySelector("input");
      if (checkbox.checked) indices.push(i - 1);
    }

    const nouvelles = data.filter((_, idx) => !indices.includes(idx));
    db.ref("journal").set(nouvelles);
  });
});

/* ============================================================
   COCHER / DÉCOCHER TOUT
   ============================================================ */

boutonToggleCheck.addEventListener("click", () => {
  let auMoinsUneDecochee = false;

  for (let i = 1; i < tableau.rows.length; i++) {
    if (!tableau.rows[i].cells[0].querySelector("input").checked) {
      auMoinsUneDecochee = true;
      break;
    }
  }

  for (let i = 1; i < tableau.rows.length; i++) {
    tableau.rows[i].cells[0].querySelector("input").checked = auMoinsUneDecochee;
  }
});

/* ============================================================
   EXPORT CSV
   ============================================================ */

document.getElementById("exportCSV").addEventListener("click", () => {
  let lignesCSV = [];

  lignesCSV.push("checked;dateISO;type;conso;km;cout;flag");

  for (let i = 1; i < tableau.rows.length; i++) {
    const cells = tableau.rows[i].cells;

    const checked = cells[0].querySelector("input").checked ? "1" : "0";
    const iso = convertirDateFRversISO(cells[1].textContent.trim());
    if (!iso) continue;

    const select = cells[2].querySelector("select");
    const inputLibre = cells[2].querySelector("input");

    let typeRecharge = select.value;
    if (select.value === "Autre (texte libre)" && inputLibre.value.trim() !== "") {
      typeRecharge = inputLibre.value.trim();
    }

    const conso = nettoyerNombre(cells[3].textContent);
    const km = nettoyerNombre(cells[4].textContent);
    const cout = nettoyerNombre(cells[5].textContent);
    const flag = cells[6].querySelector("select").value;

    lignesCSV.push([checked, iso, typeRecharge, conso, km, cout, flag].join(";"));
  }

  const blob = new Blob([lignesCSV.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "journal.csv";
  a.click();

  URL.revokeObjectURL(url);
});

/* ============================================================
   CORRECTION DES DATES ÉDITÉES
   ============================================================ */

tableau.addEventListener("input", (e) => {
  const cell = e.target;

  if (cell.cellIndex === 1) {
    const iso = convertirDateFRversISO(cell.textContent.trim());
    if (!iso) {
      cell.style.color = "red";
      return;
    }
    cell.dataset.iso = iso;
    cell.textContent = formatDateAffichage(iso);
    cell.style.color = "#333";
  }

  if (cell.dataset.type === "cout") {
    validerCout(cell);
  }
});

/* ============================================================
   RÉGLAGE MANUEL DES ÉCHELLES
   ============================================================ */

document.getElementById("applyScale").addEventListener("click", () => {
  if (!graphKm) return;

  const xmin = document.getElementById("scaleXmin").value.trim();
  const xmax = document.getElementById("scaleXmax").value.trim();
  const ymin = document.getElementById("scaleYmin").value.trim();
  const ymax = document.getElementById("scaleYmax").value.trim();

  const xMinDate = xmin ? new Date(xmin) : null;
  const xMaxDate = xmax ? new Date(xmax) : null;

  if (xmin && isNaN(xMinDate.getTime())) {
    alert("Min X n'est pas une date ISO valide.");
    return;
  }
  if (xmax && isNaN(xMaxDate.getTime())) {
    alert("Max X n'est pas une date ISO valide.");
    return;
  }

  graphKm.options.scales.x.min = xmin ? xMinDate : undefined;
  graphKm.options.scales.x.max = xmax ? xMaxDate : undefined;

  graphKm.options.scales.y.min = ymin ? Number(ymin) : undefined;
  graphKm.options.scales.y.max = ymax ? Number(ymax) : undefined;

  graphKm.update();
});
