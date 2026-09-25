import { Router } from 'express';
import { getHealth } from '../controllers';

const healthRouter = Router();

healthRouter.get('/', getHealth);

export { healthRouter };
