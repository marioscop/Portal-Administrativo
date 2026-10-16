import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class AllExceptionsFilter implements ExceptionFilter {
    private static fallbackFor;
    catch(exception: unknown, host: ArgumentsHost): void;
}
