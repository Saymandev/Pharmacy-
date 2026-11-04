/** Small arithmetic parser: no JavaScript evaluation and no effect on sale totals. */
export function calculate(input: string): number {
  const source = input.replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/\s/g, "");
  if (!source || source.length > 120 || /[^\d.+*/%()\-]/.test(source)) throw new Error("Invalid calculation");
  let at = 0;
  function atom(): number {
    if (source[at] === "+") { at++; return atom(); }
    if (source[at] === "-") { at++; return -atom(); }
    let value: number;
    if (source[at] === "(") { at++; value = sum(); if (source[at++] !== ")") throw new Error("Invalid calculation"); }
    else {
      const match = source.slice(at).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) throw new Error("Invalid calculation");
      at += match[0].length; value = Number(match[0]);
    }
    while (source[at] === "%") { at++; value /= 100; }
    return value;
  }
  function product(): number {
    let value = atom();
    while (source[at] === "*" || source[at] === "/") {
      const op = source[at++], right = atom();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (source[at] === "+" || source[at] === "-") { const op = source[at++], right = product(); value = op === "+" ? value + right : value - right; }
    return value;
  }
  const result = sum();
  if (at !== source.length || !Number.isFinite(result)) throw new Error("Invalid calculation");
  return Number(result.toPrecision(12));
}
