import {
  requestLogger,
  ignoreResponseBodyLogging,
} from "./middlewares/requestLogger.middleware";
import errorHandler from "./middlewares/errorHandler.middleware";
import tokenValidator from "./middlewares/tokenValidator.middleware";

export default {
  requestLogger,
  errorHandler,
  tokenValidator,
  ignoreResponseBodyLogging,
};
