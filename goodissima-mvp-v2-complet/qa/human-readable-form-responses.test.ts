import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildHumanReadableFormAnswers,
  buildHumanReadableFormMessage,
  formatFormAnswerValue,
  type HumanReadableFormField,
} from "../lib/forms.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const housingFields: HumanReadableFormField[] = [
  { key: "localisationSouhaitee", label: "Localisation souhaitée", type: "TEXT" },
  { key: "budgetMinimum", label: "Budget minimum", type: "NUMBER" },
  { key: "budgetMaximum", label: "Budget maximum", type: "NUMBER" },
  { key: "surfaceMinimum", label: "Surface minimum", type: "NUMBER" },
  { key: "surfaceMaximum", label: "Surface maximum", type: "NUMBER" },
  { key: "nombrePieces", label: "Nombre de pièces", type: "NUMBER" },
];

test("renders candidate form response as a labeled conversation summary", () => {
  const message = buildHumanReadableFormMessage(housingFields, {
    localisationSouhaitee: "Beauvais",
    budgetMinimum: "651",
    budgetMaximum: "779",
    surfaceMinimum: "56",
    surfaceMaximum: "70",
    nombrePieces: "1",
  });

  assert.equal(
    message,
    [
      "Réponse au formulaire",
      "",
      "Localisation souhaitée : Beauvais",
      "Budget minimum : 651 €",
      "Budget maximum : 779 €",
      "Surface minimum : 56 m²",
      "Surface maximum : 70 m²",
      "Nombre de pièces : 1",
    ].join("\n"),
  );
  assert.doesNotMatch(message, /budgetMinimum|surfaceMaximum|nombrePieces/);
});

test("preserves raw answers by field id while adding labels and formatted values", () => {
  const answers = buildHumanReadableFormAnswers(housingFields, {
    budgetMinimum: "651",
  });

  assert.deepEqual(answers, [
    {
      fieldId: "budgetMinimum",
      label: "Budget minimum",
      value: "651",
      formattedValue: "651 €",
      type: "NUMBER",
    },
  ]);
});

test("formats booleans, dates, select values and multiple choices", () => {
  const fields: HumanReadableFormField[] = [
    { key: "certifie", label: "Profil certifié", type: "CHECKBOX" },
    { key: "dateEntree", label: "Date d’entrée souhaitée", type: "DATE" },
    {
      key: "typeBien",
      label: "Type de bien",
      type: "SELECT",
      options: [
        { label: "Appartement", value: "apartment" },
        { label: "Maison", value: "house" },
      ],
    },
    {
      key: "equipements",
      label: "Équipements",
      type: "CHECKBOX",
      options: [
        { label: "Balcon", value: "balcony" },
        { label: "Parking", value: "parking" },
      ],
    },
  ];
  const message = buildHumanReadableFormMessage(fields, {
    certifie: true,
    dateEntree: "2026-09-15",
    typeBien: "apartment",
    equipements: ["balcony", "parking"],
  });

  assert.match(message, /Profil certifié : Oui/);
  assert.match(message, /Date d’entrée souhaitée : 15\/09\/2026/);
  assert.match(message, /Type de bien : Appartement/);
  assert.match(message, /Équipements : Balcon, Parking/);
});

test("keeps backward-compatible fallback for empty form response", () => {
  assert.equal(buildHumanReadableFormMessage([], {}), "Réponse au formulaire candidat.");
  assert.equal(formatFormAnswerValue({ label: "Option", type: "CHECKBOX", value: false }), "Non");
});

test("case creation uses readable form message and still stores raw form submission", () => {
  const route = source("app/api/cases/route.ts");

  assert.match(route, /buildHumanReadableFormMessage\(submittedFormFields, formSubmission\.answers\)/);
  assert.match(route, /createFormSubmission/);
  assert.match(route, /answers: formSubmission\.answers/);
  assert.doesNotMatch(route, /Object\.values\(formSubmission\?\.answers/);
});
