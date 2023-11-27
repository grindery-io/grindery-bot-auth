import express from 'express';
import pkg from 'body-parser';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import path from 'path';
import { fileURLToPath } from 'url';
import './loadEnvironment';
import router from './router';
import './scripts/cronjob.ts';
import { PORT } from '../secrets';

const { json, urlencoded } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  info: {
    version: '1.0.2',
    title: 'Grindery AI API',
    description: 'API for Grindery AI Bot',
    license: {
      name: 'MIT',
    },
  },
  security: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  servers: [
    {
      url: 'https://bot-auth-api.grindery.org',
      description: 'Production server',
    },
  ],
  // Base directory which we use to locate your JSDOC files
  baseDir: __dirname,
  // Glob pattern to find your jsdoc files (multiple patterns can be added in an array)
  filesPattern: './**/*.js',
  // URL where SwaggerUI will be rendered
  swaggerUIPath: '/docs',
  // Expose OpenAPI UI
  exposeSwaggerUI: true,
  // Expose Open API JSON Docs documentation in `apiDocsPath` path.
  exposeApiDocs: true,
  // Open API JSON Docs endpoint.
  apiDocsPath: '/openapi',
  // Set non-required fields as nullable by default
  notRequiredAsNullable: false,
  // You can customize your UI options.
  // you can extend swagger-ui-express config. You can checkout an example of this
  // in the `example/configuration/swaggerOptions.js`
  swaggerUiOptions: {},
  // multiple option in case you want more that one instance
  multiple: false,
};

const app = express();

expressJSDocSwagger(app)(options);

app.set('trust proxy', 1);

// Force SSL
// No need on GCP
// app.use(sslRedirect());

// Enable CORS
app.use(function (req, res, next) {
  // res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Origin', req.get('origin'));
  res.header(
    'Access-Control-Allow-Headers',
    'X-CSRFToken, Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header('Access-Control-Allow-Credentials', true as any);
  res.header(
    'Access-Control-Allow-Methods',
    'HEAD,OPTIONS,GET,POST,PUT,PATCH,DELETE',
  );

  if (req.method === 'OPTIONS') {
    // Return OK response for CORS preflight
    res.json({ message: 'Ok' });
  } else {
    next();
  }
});

// JSON Parser
const bodyParserAddRawBody = (req, res, buf): void => {
  req.rawBody = buf.toString();
};
app.use(
  json({
    verify: bodyParserAddRawBody,
  }),
);
app.use(
  urlencoded({
    extended: false,
    verify: bodyParserAddRawBody,
  }),
);

app.get('/', (_req, res) => {
  // res.redirect("/docs");
  // GCP expects 200 response for root url
  res
    .set('Content-Type', 'text/html')
    .send("<script>location.href = '/docs'</script>");
});

const port = PORT || 3000;

app.listen(port, function () {
  console.log(`Bot auth API listening on port ${port}`);
});

app.use('/v1/', router);

export default app;
