import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import { isValidLocalDate, type LocalDateString } from '../date/local-date';

@Injectable()
export class LocalDatePipe implements PipeTransform<string, LocalDateString> {
  transform(value: string): LocalDateString {
    if (!isValidLocalDate(value)) {
      throw new BadRequestException('Date must be a calendar date in YYYY-MM-DD format');
    }

    return value;
  }
}
