import Typesense from "typesense";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "localhost",
      port: parseInt(process.env.TYPESENSE_PORT || "8108"),
      protocol: process.env.TYPESENSE_PROTOCOL || "http",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "",
  connectionTimeoutSeconds: 60,
});

export default client;
