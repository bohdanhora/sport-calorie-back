import { registerDecorator, type ValidationOptions } from 'class-validator';

import { isValidLocalDate } from '../date/local-date';

export const IsLocalDate =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isLocalDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidLocalDate(value),
        defaultMessage: () => `${propertyName} must be a calendar date in YYYY-MM-DD format`,
      },
    });
  };
