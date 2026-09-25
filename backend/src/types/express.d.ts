export {};

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      user?: AuthenticatedUser;
    }
  }
}