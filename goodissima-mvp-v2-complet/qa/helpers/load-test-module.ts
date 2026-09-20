import { readFileSync } from "node:fs";
import ts from "typescript";

/** Execute the real TS/TSX entrypoint with explicit dependency doubles, in memory.
 * Unlisted imports fail: tests cannot silently connect to a database or send mail.
 */
export function loadTestModule<T = any>(
  file: string,
  dependencies: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  const require = (name: string) => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unmocked dependency: ${file}: ${name}`);
    return dependencies[name];
  };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    require, module, module.exports, ...Object.values(globals),
  );
  return module.exports as T;
}
