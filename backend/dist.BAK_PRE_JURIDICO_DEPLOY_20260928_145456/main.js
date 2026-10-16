"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const helmet_1 = __importDefault(require("helmet"));
const express_1 = require("express");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        xssFilter: true,
        hidePoweredBy: true,
        frameguard: false,
        hsts: false,
        noSniff: true,
        ieNoOpen: true,
        permittedCrossDomainPolicies: { permittedPolicies: 'none' },
        referrerPolicy: { policy: 'no-referrer-when-downgrade' },
    }));
    app.enableCors({
        origin: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        credentials: true,
        maxAge: 86400,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: false,
        forbidNonWhitelisted: false,
        forbidUnknownValues: false,
        transformOptions: { enableImplicitConversion: false },
    }));
    app.use((0, express_1.json)({ limit: '12mb' }));
    app.use((0, express_1.urlencoded)({ limit: '12mb', extended: true }));
    const frontendDistPath = (0, path_1.join)(__dirname, '../../frontend/dist');
    app.use((0, express_1.static)(frontendDistPath, {
        setHeaders(res, filePath) {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-store');
                return;
            }
            const isHashedAsset = filePath.endsWith('.js') ||
                filePath.endsWith('.css') ||
                filePath.endsWith('.woff2') ||
                filePath.endsWith('.woff') ||
                filePath.endsWith('.ttf');
            if (isHashedAsset) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return;
            }
            const isImage = filePath.endsWith('.png') ||
                filePath.endsWith('.jpg') ||
                filePath.endsWith('.jpeg') ||
                filePath.endsWith('.svg') ||
                filePath.endsWith('.webp') ||
                filePath.endsWith('.ico');
            if (isImage) {
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                return;
            }
            res.setHeader('Cache-Control', 'public, max-age=3600');
        },
        fallthrough: true,
    }));
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api')) {
            res.setHeader('Cache-Control', 'no-store');
            res.sendFile((0, path_1.join)(frontendDistPath, 'index.html'));
        }
        else {
            next();
        }
    });
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
}
void bootstrap();
//# sourceMappingURL=main.js.map