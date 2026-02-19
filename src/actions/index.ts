import { adminActions } from './admin';
import { authActions } from './auth';
import { chapterActions } from './chapters';
import { commentActions } from './comments';
import { newsActions } from './news';
import { seriesActions } from './series';
import { userActions } from './user';

export const server = {
  admin: adminActions,
  auth: authActions,
  user: userActions,
  news: newsActions,
  series: seriesActions,
  chapters: chapterActions,
  comments: commentActions,
};
