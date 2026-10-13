import createDebug from "debug";
import chalk from "chalk";
import app from "./app.js";

const debug = createDebug("glosa:server");

const startServer = (port: number): void => {
  app.listen(port, () => {
    debug(
      chalk.bold.green("+++ Server listening on: => ") +
        chalk.bold.underline.white(port),
    );
  });
};

export default startServer;
