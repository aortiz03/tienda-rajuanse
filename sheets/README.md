# Order sheet ↔ website

The Google Sheet is where orders and prices live. This folder holds the sheet's
script (`Code.gs`), which connects it to the shop in two directions:

- **Website → sheet.** Every order placed on the site is added to the
  `customers`, `orders` and `order_items` tabs with status `nuevo` and channel `web`.
  The order still goes to WhatsApp or email as before. The `WEB-…` reference at the
  top of that message matches the `internal_note` of the row in the sheet.
- **Sheet → website.** The site reads `price_nio`, `price_usd` and `active` from the
  `product_variants` tab each time it is published: every day at 6:00 (Managua time),
  or right away from the sheet's **Tienda → Publicar cambios en la web** menu.
  A blank price keeps the website's current price; `active = no` hides that bag.

The web address of the script shares prices and availability with everyone.
Customer and order data can only be read back by a signed-in customer, and only
their own orders.

- **Customer accounts (optional for customers).** A customer who signs in on the
  site with their email or phone sees their past orders and gets checkout pre-filled.
  The script checks every sign-in with Firebase. The first time someone signs in, their
  account is linked to an existing customer row only if the email or phone they
  *verified* matches it. What someone types in the form is never enough to see
  someone else's orders. Linked rows get `auth_uid` and `auth_provider` filled in.

## One-time setup (about 20 minutes)

1. **Create the sheet.** In Google Drive (use the company account), upload
   `rajuanse-pedidos.xlsx`, open it, and choose **File → Save as Google Sheets**.
   Fill in `price_nio` and `price_usd` on the `product_variants` tab.
2. **Add the script.** In the sheet, open **Extensions → Apps Script**. Delete what is
   in `Code.gs`, paste the contents of [`Code.gs`](Code.gs), and click **Save**.
3. **Publish the script.** Click **Deploy → New deployment**. Under "Select type"
   choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then
   **Deploy**. Google asks you to authorise it: choose your account, then
   **Advanced → Go to (project name) → Allow**. Copy the **Web app URL**.
4. **Give the URL to the website.** In GitHub, open the repo's
   **Settings → Secrets and variables → Actions → Variables** tab and add a
   repository variable named `SHEET_API_URL` with that URL.
5. **Set up the publish button** (optional; without it the site still updates daily).
   - In GitHub, go to your profile picture → **Settings → Developer settings →
     Personal access tokens → Fine-grained tokens → Generate new token**.
     Name it "Hoja de pedidos", set expiration to 1 year, choose
     **Only select repositories → tienda-rajuanse**, and under
     **Repository permissions** set **Contents** to **Read and write**. Generate it and copy it.
   - Back in Apps Script, open **Project Settings** (gear icon) → **Script Properties →
     Add script property**. Name: `GITHUB_TOKEN`, value: the token. Save.
   - Reload the sheet. A **Tienda** menu appears next to Help.
6. **Turn on customer sign-in** (after Firebase is set up for the website).
   In the Firebase console, open **Project settings → General** and copy the
   **Web API key**. In Apps Script, add a script property named `FIREBASE_API_KEY`
   with that value. Without it, the site still takes guest orders, but
   "my orders" stays empty.
7. **Test it.** Place a small order on the website. Within a few seconds it should
   appear in the `orders` tab. Change a price, use **Tienda → Publicar cambios en la
   web**, and check the site after 2 to 3 minutes.

## Admin dashboard (panel de administración)

A private page for running the shop day to day, in Spanish, that works on a phone
too. It reads and writes this same sheet, so the sheet stays the single source of truth.

- **Resumen:** new orders, orders to pack and ship, sales this month, bags to pack,
  and low-stock warnings.
- **Pedidos:** every order with filters and search. Open one to move it to the next
  status, mark it **Completar (entregado)**, cancel it, record payment, shipping,
  discount and internal notes, or open the customer's WhatsApp.
- **Nuevo pedido:** add an order that came in by WhatsApp, email or in person. Pick
  an existing customer or type a new one (a phone number that already exists reuses
  that customer). It gets the next `RJ-…` number, like web orders.
- **Inventario:** roasted coffee in kg, one row per coffee and roast (`SS-MED`,
  `FR-PCL`, …). Record a new roast (**Entrada**) or a count (**Conteo**). When an order
  moves to `tostado / empacado` (or later) its coffee is subtracted automatically;
  moving it back, or cancelling it before it ships, puts it back. A coffee with no
  count yet is "sin controlar" and is not subtracted. Every change is logged.
- **Productos y precios:** edit `price_nio`, `price_usd` and `active` for every bag,
  then **Publicar en la web**.

The dashboard adds two tabs, `inventory` and `inventory_moves`, and a
`stock_deducted` column at the end of `orders`, by itself the first time it opens.

**Who can open it.** Only the Google accounts listed in the script property
`ADMIN_EMAILS` (comma-separated). If that property is empty, only the account that
owns the script can. Anyone else who opens the address just sees the public
`{"ok":true,...}` reply. No extra cost: it runs on the same Apps Script.

### Setup (about 5 minutes)

1. In Apps Script, click **+ → Script**, name it `Admin`, and paste
   [`Admin.gs`](Admin.gs). Click **+ → HTML**, name it `Admin`, and paste
   [`Admin.html`](Admin.html). Paste the new [`Code.gs`](Code.gs) over the old one too. Save.
2. **Project Settings → Script Properties → Add script property:** `ADMIN_EMAILS` =
   your Google email (add more separated by commas if someone helps you).
3. Update the shop's deployment: **Deploy → Manage deployments → edit (pencil) →
   Version: New version → Deploy** (keeps the same URL).
4. Make the dashboard's own address: **Deploy → New deployment → Web app**,
   description "Panel", **Execute as: Me**, **Who has access: Only myself**, **Deploy**.
   Bookmark that **Web app URL** on your computer and phone. Google asks you to
   approve the new permissions once.
5. If you add staff later: put their email in `ADMIN_EMAILS` and change that
   deployment's access to **Anyone with a Google account** (they still need to sign in
   with a listed account).

To change the items in an existing order, edit the `order_items` tab directly.
Adding a brand-new coffee still needs a change to the website code (photos and text).

**Moving to a database later.** The page only talks to the `admin…` functions in
`Admin.gs` through one function, `api()`, in `Admin.html`. Rewrite those functions
against the database and point `api()` at it; the page itself stays the same.

## Good to know

- **Don't rename tabs or column headers.** The script finds columns by their names.
  Adding new columns at the end is fine.
- **Changing the script later:** after saving, use **Deploy → Manage deployments →
  edit (pencil) → Version: New version → Deploy**. This keeps the same URL.
- **Repeated orders:** if a customer presses both the WhatsApp and the email button,
  the order is only added once.
- **Abandoned orders:** an order lands in the sheet when the customer presses the
  button, even if they never send the WhatsApp message. Mark those `cancelado`.
- **Spam protection:** the script checks every product code, quantity and price,
  ignores bot submissions, and accepts at most 30 orders every 10 minutes.
- **Sheets made before sign-in was added:** the script adds the `auth_uid` and
  `auth_provider` columns to `customers` by itself the first time someone signs in.
- **An expired sign-in never loses an order.** The order is saved as a guest order instead.
- **The token expires** after a year. Make a new one and replace `GITHUB_TOKEN`.
