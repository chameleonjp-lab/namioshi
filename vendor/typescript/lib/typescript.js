export const ScriptTarget = { ES2020: 'ES2020' };
export const ModuleKind = { ES2020: 'ES2020' };

export function transpileModule(sourceText) {
  return { outputText: sourceText };
}

export default { transpileModule, ScriptTarget, ModuleKind };
