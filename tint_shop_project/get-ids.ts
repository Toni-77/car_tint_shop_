export {}; 
import { SquareClient, SquareEnvironment } from "square";

// 1. Redefine the client here for this script
const client = new SquareClient({
  token: "EAAAl8dC_0s0aQwSz7ZtEjPkUur_us-F7e5tHOBz0OYSi06tDNAcV_XBGfLM6dVd", // Use your EAAAE... token
  environment: SquareEnvironment.Production, 
});

async function main() {
  try {
    const response = await client.catalog.list({ types: "ITEM" });
    console.log("--- FOUND YOUR SERVICES ---");

    for await (const service of response) {
      if (service.type === "ITEM" && service.itemData) {
        console.log(`\nService: ${service.itemData.name}`);

        const variations = service.itemData.variations || [];
        for (const variation of variations) {
          // Prove to TypeScript this is a variation
          if (variation.type === "ITEM_VARIATION" && variation.itemVariationData) {
            console.log(`  > Variation: ${variation.itemVariationData.name}`);
            console.log(`    ID to use:  ${variation.id}`); // This is your VAR_... ID
          }
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
