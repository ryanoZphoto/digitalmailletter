import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config({ path: "mail-my-forms/server/.env" });

const LOB_API_KEY = process.env.LOB_API_KEY;

if (!LOB_API_KEY) {
  console.error("❌ LOB_API_KEY not set in .env");
  process.exit(1);
}

async function sendTestPostcard() {
  const form = new FormData();

  // Required addresses
  form.append("description", "Just Listed Postcard Test");
  form.append("to[name]", "Alice Receiver");
  form.append("to[address_line1]", "210 King St");
  form.append("to[address_city]", "San Francisco");
  form.append("to[address_state]", "CA");
  form.append("to[address_zip]", "94107");
  form.append("to[address_country]", "US");

  form.append("from[name]", "Bob Sender");
  form.append("from[address_line1]", "123 Market St");
  form.append("from[address_city]", "San Francisco");
  form.append("from[address_state]", "CA");
  form.append("from[address_zip]", "94105");
  form.append("from[address_country]", "US");

  form.append("use_type", "marketing");

  // Attach front and back templates
  form.append(
    "front",
    fs.createReadStream(
      "templates/industries/real-estate/just-listed-postcard.hbs"
    )
  );
  form.append(
    "back",
    fs.createReadStream(
      "templates/industries/real-estate/just-listed-postcard-back.hbs"
    )
  );

  // Merge vars
  form.append("merge_variables[property_image_url]", "https://via.placeholder.com/600x400.jpg");
  form.append("merge_variables[property_address]", "123 Main St, San Francisco, CA");
  form.append("merge_variables[beds]", "3");
  form.append("merge_variables[baths]", "2");
  form.append("merge_variables[sqft]", "1450");
  form.append("merge_variables[listing_price]", "950000");
  form.append("merge_variables[open_house_date]", "Oct 10, 2025");
  form.append("merge_variables[agent_photo]", "https://via.placeholder.com/150");
  form.append("merge_variables[agent_name]", "John Agent");
  form.append("merge_variables[agent_phone]", "555-123-4567");
  form.append("merge_variables[agent_email]", "john@example.com");
  form.append("merge_variables[qr_code_url]", "https://api.qrserver.com/v1/create-qr-code/?data=https://example.com/listing/123");
  form.append("merge_variables[company_name]", "Acme Realty");
  form.append("merge_variables[company_address]", "123 Market St, San Francisco, CA");

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString("base64")}`,
    },
    body: form,
  });

  const json = await res.json();

  // Save response for proof
  fs.writeFileSync("postcard_test_result.json", JSON.stringify(json, null, 2));
  console.log("📬 Test postcard sent. Response saved to postcard_test_result.json");
  if (json.url) console.log("Preview URL:", json.url);
}

sendTestPostcard().catch(err => {
  console.error("Error:", err);
});
