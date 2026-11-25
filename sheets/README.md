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

The web address of the script only shares prices and availability. Customer and
order data can be added through it but never read back.

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
6. **Test it.** Place a small order on the website. Within a few seconds it should
   appear in the `orders` tab. Change a price, use **Tienda → Publicar cambios en la
   web**, and check the site after 2 to 3 minutes.

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
- **The token expires** after a year. Make a new one and replace `GITHUB_TOKEN`.
