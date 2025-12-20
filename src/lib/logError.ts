// src/lib/logError.ts

export function logError(error: unknown, message: string, context?: Record<string, any>) {
  let errorMessage = message;
  let errorDetails: any = {};

  if (error instanceof Error) {
    errorMessage += `: ${error.message}`;
    errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (typeof error === 'string') {
    errorMessage += `: ${error}`;
    errorDetails = { message: error };
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage += `: ${error.message}`;
    errorDetails = error;
  } else {
    errorMessage += `: ${String(error)}`;
    errorDetails = { message: String(error) };
  }

  console.error(
    'Error:',
    errorMessage,
    '\nDetails:',
    JSON.stringify(errorDetails, null, 2),
    context ? '\nContext:' : '',
    context ? JSON.stringify(context, null, 2) : ''
  );
}
