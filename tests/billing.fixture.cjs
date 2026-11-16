const assert = require("node:assert/strict"),
  path = require("node:path");
module.exports = () => {
  const target = "a",
    date = "2026-11-16T00:00:00Z",
    invoices = [],
    payments = [],
    entries = [],
    proofs = [],
    saved = new Map();
  let commits = 0;
  const reviewRequest={id:'request-1',targetTenantId:'a',revision:1,kind:'RENEWAL',invoiceId:null,payload:{kind:'RENEWAL',note:'Please renew our shop agreement'},status:'OPEN',response:null,createdAt:date,updatedAt:date};
  const invoice = {
    id: "invoice-1",
    targetTenantId: target,
    currency: "BDT",
    number: null,
    revision: 1,
    subscriptionRevision: 1,
    purpose: "CURRENT",
    state: "DRAFT",
    totalMinor: 10000,
    dueMinor: 10000,
    allocatedMinor: 0,
    creditedMinor: 0,
    settled: false,
    dueAt: date,
    snapshot: {
      seller: { name: "SaaS Merchant", address: "Test address" },
      buyer: { name: "Test Pharmacy", address: "Shop address" },
      description: "Monthly subscription",
      periodStart: date,
      periodEnd: "2026-12-16T00:00:00Z",
      grossMinor: 10000,
      discountMinor: 0,
      subtotalMinor: 10000,
      taxMinor: 0,
      totalMinor: 10000,
    },
  };
  return {
    handle(req, res, url, body, key) {
      if (!url.pathname.startsWith("/api/v1/platform/shops/a/billing"))
        return false;
      const send = (status, data, message) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ success: status < 400, data, message }));
        return true;
      };
      if(url.pathname==='/api/v1/platform/shops/a/billing-requests')return send(200,[reviewRequest]);
      if(url.pathname==='/api/v1/platform/shops/a/billing-requests/request-1/review'){
        if(saved.has(key))return send(200,saved.get(key));
        Object.assign(reviewRequest,{status:body.status,response:body.response,revision:2});const result={id:reviewRequest.id,status:reviewRequest.status,revision:2};saved.set(key,result);return send(503,null,'Review saved but response lost');
      }
      if (req.method === "GET" && url.pathname.includes("/proofs/")) {
        res.writeHead(200, {"content-type":"application/pdf","content-disposition":'attachment; filename="bank-proof.pdf"'});
        res.end(Buffer.from("%PDF-1.4 test proof"));return true;
      }
      if (req.method === "GET")
        return send(200, {
          targetTenantId: target,
          currency: "BDT",
          subscriptionRevision: 1,
          merchantConfigured: true,
          historyWindow: 50,
          invoices,
          payments,
          entries,
          proofEnabled: true,
          proofs,
          credits: [],
          eligiblePlans: [
            { id: "plan-lower", name: "Lower pharmacy", price: "50.00" },
          ],
        });
      if (url.pathname.endsWith("/proofs")) {
        if (saved.has(key)) return send(201, saved.get(key));
        const proof = {
          id: "proof-1",
          targetTenantId: target,
          paymentId: "payment-1",
          name: "bank-proof.pdf",
          mime: "application/pdf",
          size: body.length,
        };
        proofs.push(proof);
        saved.set(key, proof);
        return send(503, null, "Proof response lost");
      }
      if (saved.has(key)) return send(200, saved.get(key));
      let receipt;
      if (url.pathname.endsWith("/change-preview"))
        receipt = {
          id: key,
          kind: "billing.change.preview",
          targetTenantId: target,
          subscriptionRevision: 1,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          config: {
            name: "Lower pharmacy",
            features: { pos: true },
            limits: { branches: 2, seats: 5, storageBytes: 1000000 },
          },
          usage: { branches: 1, seats: 1, storageBytes: 0 },
          creditMinor: 10000,
          debitMinor: 5000,
          chargeMinor: 0,
          shopCreditMinor: 5000,
        };
      else if (url.pathname.endsWith("/invoices")) {
        if (body.purpose === "CHANGE") {
          receipt = {
            ...invoice,
            id: "change-invoice",
            number: null,
            state: "DRAFT",
            purpose: "CHANGE",
            totalMinor: 0,
            dueMinor: 0,
            allocatedMinor: 0,
            settled: false,
          };
          invoices.push(receipt);
        } else {
          invoices.push(invoice);
          receipt = invoice;
        }
      } else if (url.pathname.endsWith("/issue")) {
        invoice.number = "SUB-1";
        invoice.state = "ISSUED";
        receipt = invoice;
      } else if (url.pathname.endsWith("/payments")) {
        receipt = {
          id: "payment-1",
          targetTenantId: target,
          currency: "BDT",
          amountMinor: 15000,
          availableMinor: 0,
          allocatedMinor: 0,
          refundedMinor: 0,
          reservedMinor: 0,
          method: "BANK",
          reference: body.reference,
          state: "PENDING",
          receivedAt: date,
        };
        payments.push(receipt);
      } else if (url.pathname.endsWith("/decision")) {
        payments[0].state = "VERIFIED";
        payments[0].availableMinor = 15000;
        receipt = payments[0];
      } else if (url.pathname.endsWith("/allocations")) {
        invoice.state = "PAID";
        invoice.dueMinor = 0;
        invoice.allocatedMinor = 10000;
        payments[0].availableMinor = 5000;
        payments[0].allocatedMinor = 10000;
        receipt = {
          id: "allocation-1",
          targetTenantId: target,
          currency: "BDT",
          kind: "ALLOCATE",
          amountMinor: 10000,
          invoiceId: invoice.id,
          paymentId: payments[0].id,
          parentId: null,
          reason: body.reason,
          createdAt: date,
        };
        entries.push(receipt);
      } else if (url.pathname.endsWith("/settle")) {
        invoice.settled = true;
        receipt = invoice;
      } else return send(404, null, "Fixture action not supported");
      commits++;
      saved.set(key, JSON.parse(JSON.stringify(receipt)));
      if (url.pathname.endsWith("/decision"))
        return send(503, null, "Verification committed but response lost");
      return send(200, receipt);
    },
    async verify(page, requests, errors) {
      await page
        .getByRole("button", { name: "Open shop Main Pharmacy", exact: true })
        .click();
      const panel = page.getByRole("region", {
        name: "Shop billing",
        exact: true,
      });
      async function confirm(title, fill) {
        const d = page.getByRole("dialog", { name: title, exact: true });
        if (fill) await fill(d);
        await d
          .getByRole("textbox", { name: "Billing reason", exact: true })
          .fill("Reviewed billing operation");
        await d.getByRole("checkbox").check();
        await d
          .getByRole("button", {
            name: "Confirm billing operation",
            exact: true,
          })
          .click();
        return d;
      }
      await panel
        .getByRole("button", { name: "Create invoice draft", exact: true })
        .click();
      let d = await confirm("Create invoice draft", async (d) => {
        await d
          .getByRole("textbox", { name: "Billing name", exact: true })
          .fill("Test Pharmacy");
        await d
          .getByRole("textbox", { name: "Billing address", exact: true })
          .fill("Shop address");
      });
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("button", { name: "Issue invoice", exact: true })
        .click();
      d = await confirm("Issue invoice");
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("button", { name: "Record manual payment", exact: true })
        .click();
      d = await confirm("Record manual payment", async (d) => {
        await d
          .getByRole("textbox", { name: "Amount", exact: true })
          .fill("150.00");
        await d
          .getByRole("textbox", { name: "Reference", exact: true })
          .fill("BANK-123");
      });
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("button", { name: "Attach payment proof", exact: true })
        .click();
      d = page.getByRole("dialog", {
        name: "Attach payment proof",
        exact: true,
      });
      await d
        .getByLabel("Proof file", { exact: true })
        .setInputFiles({
          name: "bank-proof.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 test proof"),
        });
      await d
        .getByRole("textbox", { name: "Billing reason", exact: true })
        .fill("Reviewed bank proof");
      await d.getByRole("checkbox").check();
      await d
        .getByRole("button", { name: "Attach proof", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Retry same request", exact: true })
        .click();
      await d.waitFor({ state: "detached" });
      assert.equal(proofs.length, 1);
      const download=await page.request.get(new URL('/api/backend/platform/shops/a/billing/proofs/proof-1',page.url()).toString());
      assert.equal(download.status(),200);assert.equal(download.headers()['content-type'],'application/pdf');assert.match(download.headers()['content-disposition'],/attachment/);assert.ok((await download.body()).toString().startsWith('%PDF-'));
      const uploads=requests.filter(v=>v.path.endsWith('/proofs')&&v.method==='POST');assert.equal(uploads.length,2);assert.equal(uploads[0].key,uploads[1].key);assert.deepEqual(uploads[0].body,uploads[1].body);
      await panel
        .getByRole("button", { name: "Verify payment", exact: true })
        .click();
      d = await confirm("Verify payment");
      await d
        .getByRole("button", { name: "Retry same request", exact: true })
        .waitFor();
      assert.ok(await d.getByRole("textbox").isDisabled());
      assert.ok(
        await d
          .getByRole("button", { name: "Cancel", exact: true })
          .isDisabled(),
      );
      await d
        .getByRole("button", { name: "Retry same request", exact: true })
        .click();
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("button", { name: "Apply payment", exact: true })
        .click();
      d = await confirm("Apply verified payment", async (d) => {
        await d.locator("select").selectOption("payment-1");
      });
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("button", { name: "Settle subscription", exact: true })
        .click();
      d = await confirm("Settle subscription");
      await d.waitFor({ state: "detached" });
      assert.equal(commits, 6);
      assert.equal(payments[0].availableMinor, 5000);
      const decisions = requests.filter(
        (v) => v.method === "POST" && v.path.endsWith("/decision"),
      );
      assert.equal(decisions.length, 2);
      assert.equal(decisions[0].key, decisions[1].key);
      assert.deepEqual(decisions[0].body, decisions[1].body);
      await panel.getByRole("button", { name: "SUB-1", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Subscription invoice", exact: true })
        .waitFor();
      await page.screenshot({
        path: path.resolve("../outputs/platform-billing-invoice.png"),
      });
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await panel
        .getByRole("button", {
          name: "Preview immediate plan change",
          exact: true,
        })
        .click();
      d = await confirm("Preview immediate plan change", async (d) => {
        await d.locator("select").selectOption("plan-lower");
      });
      await d.waitFor({ state: "detached" });
      await panel
        .getByRole("complementary", {
          name: "Plan change preview",
          exact: true,
        })
        .waitFor();
      await panel
        .getByRole("button", { name: "Create change invoice", exact: true })
        .click();
      d = await confirm("Create change invoice", async (d) => {
        await d
          .getByRole("textbox", { name: "Billing name", exact: true })
          .fill("Test Pharmacy");
        await d
          .getByRole("textbox", { name: "Billing address", exact: true })
          .fill("Shop address");
      });
      await d.waitFor({ state: "detached" });
      assert.equal(invoices.at(-1).purpose, "CHANGE");
      const queue=page.getByRole('region',{name:'Shop billing requests',exact:true});await queue.getByRole('button',{name:'Shop billing requests',exact:true}).click();await queue.getByRole('button',{name:'Review request',exact:true}).click();await queue.getByRole('textbox',{name:'Response visible to shop owner',exact:true}).fill('Renewal invoice is ready; payment verification is separate.');await queue.locator('select').selectOption('RESOLVED');await queue.getByRole('button',{name:'Save request review',exact:true}).click();await queue.getByRole('button',{name:'Retry same request',exact:true}).waitFor();assert.equal(await queue.getByRole('textbox',{name:'Response visible to shop owner',exact:true}).isDisabled(),true);const [reviewResponse]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/request-1/review')),queue.getByRole('button',{name:'Retry same request',exact:true}).click()]);assert.equal(reviewResponse.status(),200,await reviewResponse.text());await queue.getByRole('button',{name:'Retry same request',exact:true}).waitFor({state:'detached'});await queue.locator('article').filter({hasText:'Renewal invoice is ready; payment verification is separate.'}).waitFor();const reviewCalls=requests.filter(r=>r.path.endsWith('/request-1/review'));assert.equal(reviewCalls.length,2);assert.equal(reviewCalls[0].key,reviewCalls[1].key);assert.deepEqual(reviewCalls[0].body,reviewCalls[1].body);
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("button", { name: "Switch to dark mode", exact: true })
        .click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await panel.locator("h3").first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.resolve("../outputs/platform-billing-dark-mobile.png"),
      });
      assert.deepEqual(errors, []);
      console.log(
        "PASS billing actual Next BFF: draft, issue, manual verification, frozen exact retry, allocation, settlement, remaining credit, invoice preview and mobile dark theme.",
      );
    },
  };
};
