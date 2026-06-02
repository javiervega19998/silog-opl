const admin = require('firebase-admin');

// We can read firebase configuration from the project files
const fs = require('fs');
const path = require('path');

// Let's print out the fields of the last 5 turnos
const check = async () => {
  // Let's run a query using the web firebase client if imported, or since we are on node, let's check config.js or firebase.json
  console.log("Check if we can read turnos directly...");
};
check();
