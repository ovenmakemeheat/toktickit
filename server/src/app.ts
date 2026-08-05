import express from "express";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "TokTickIT API" });
});

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
