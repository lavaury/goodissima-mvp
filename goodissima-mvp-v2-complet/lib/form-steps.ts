export type SteppedField = {
  step?: number | null;
};

function normalizeStep(step: number | null | undefined) {
  return Number.isInteger(step) && step && step > 0 ? step : 1;
}

export function groupFieldsByStep<T extends SteppedField>(fields: T[]) {
  return fields.reduce<Record<number, T[]>>((groups, field) => {
    const step = normalizeStep(field.step);
    groups[step] = groups[step] ?? [];
    groups[step].push(field);
    return groups;
  }, {});
}

export function getStepCount(fields: SteppedField[]) {
  const steps = fields.map((field) => normalizeStep(field.step));
  return steps.length ? Math.max(...steps) : 1;
}

export function getFieldsForStep<T extends SteppedField>(fields: T[], step: number) {
  const currentStep = normalizeStep(step);
  return fields.filter((field) => normalizeStep(field.step) === currentStep);
}
