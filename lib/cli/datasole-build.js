const commander = require("commander");

commander
  .description("Develop a Datasole app with local preview")
  .option("-i, --integer <n>", "An integer")
  .parse(process.argv);
