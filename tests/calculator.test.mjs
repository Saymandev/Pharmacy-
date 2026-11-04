import {test} from "node:test";
import assert from "node:assert/strict";
import {calculate} from "../src/features/pos/calculator-policy.ts";
test("calculator evaluates precedence, brackets, signs, decimals and percentage without executing code",()=>{
 for(const [source,value]of [["10+5*2",20],["(10+5)*2",30],["-5+2",-3],["10÷4",2.5],["200*10%",20],["১২+৩",15],[".1+.2",.3],["2*-3",-6]])assert.equal(calculate(source),value,source);
});
test("calculator rejects invalid syntax, division by zero and non-arithmetic input",()=>{
 for(const source of ["", "1/0", "0/0", "(2+3", "1..2", "2+","alert(1)","2**3","2(3)","1".repeat(121)])assert.throws(()=>calculate(source),undefined,source);
});
