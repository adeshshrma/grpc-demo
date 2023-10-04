const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());

const packageDefinitionReci = protoLoader.loadSync(
  path.join(__dirname, "../recipes-ms/recipe.proto")
);
const packageDefinitionProc = protoLoader.loadSync(
  path.join(__dirname, "../orders-ms/processing.proto")
);
const recipesProto = grpc.loadPackageDefinition(packageDefinitionReci);
const processingProto = grpc.loadPackageDefinition(packageDefinitionProc);

const recipesStub = new recipesProto.Recipes(
  "0.0.0.0:50051",
  grpc.credentials.createInsecure()
);
const processingStub = new processingProto.Processing(
  "0.0.0.0:50052",
  grpc.credentials.createInsecure()
);

// console.log(`Searching a recipe for the product: ${productId}`);
// recipesStub.find({ id: productId }, (err, recipe) => {
//   console.log("Found a recipe:");
//   console.log(recipe);
//   console.log("Processing...");
//   const call = processingStub.process({ orderId, recipeId: recipe.id });
//   call.on("data", (statusUpdate) => {
//     console.log("Order status changed:");
//     console.log(statusUpdate);
//   });
//   call.on("end", () => {
//     console.log("Processing done.");
//   });
// });

let orders = {};

function processAsync(order) {
  console.log("order:", order);
  recipesStub.find({ id: order.productId }, (err, recipe) => {
    if (err) return;
    console.log("recipe:", recipe);
    orders[order.id].recipe = recipe;
    console.log(orders[order.id]);
    const call = processingStub.process({
      orderId: order.id,
      recipeId: recipe.id,
    });
    call.on("data", (statusUpdate) => {
      console.log("Order status changed:", statusUpdate.status);
      orders[order.id].status = statusUpdate.status;
    });
  });
}

app.post("/orders", (req, res) => {
  if (!req.body.productId) {
    res.status(400).send("Product identifier is not set");
    return;
  }
  let orderId = Object.keys(orders).length + 1;
  let order = {
    id: orderId,
    status: 0,
    productId: req.body.productId,
    createdAt: new Date().toLocaleString(),
  };
  orders[order.id] = order;
  processAsync(order);
  res.send(order);
});

app.get("/orders/:id", (req, res) => {
  if (!req.params.id || !orders[req.params.id]) {
    res.status(400).send("Order not found");
    return;
  }
  res.send(orders[req.params.id]);
});

app.listen(5000, () => {
  console.log("Listening on port 5000");
});
