import { registerDecorator, type ValidationOptions } from 'class-validator';

import { isValidTimeZone } from '../date/local-date';

export const IsTimeZone =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidTimeZone(value),
        defaultMessage: () => `${propertyName} must be a valid IANA timezone identifier`,
      },
    });
  };
