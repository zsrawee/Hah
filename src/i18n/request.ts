import {getRequestConfig} from 'next-intl/server';
import { locales } from './locales';

export default getRequestConfig(async ({requestLocale}) => {
  // This resolves locale from the request
  const locale = await requestLocale;
  try {
    return {
      locale,
      messages: (await import(`../messages/${locale}.json`)).default,
    };
  } catch {
    return {
      locale,
      messages: (await import(`../messages/en.json`)).default,
    };
  }
});
