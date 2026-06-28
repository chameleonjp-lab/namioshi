export const ScriptTarget = { ES2020: 'ES2020' };
export const ModuleKind = { ES2020: 'ES2020' };

export function transpileModule(sourceText) {
  let outputText = sourceText;
  outputText = outputText.replace(/import\s+type\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '');
  outputText = outputText.replace(/export\s+type\s+[^;]+;?/g, '');
  outputText = outputText.replace(/\s+as\s+const\b/g, '');
  outputText = outputText.replace(/\)\s*as\s+[^;,)]+/g, ')');
  return { outputText };
}

export default { transpileModule, ScriptTarget, ModuleKind };
