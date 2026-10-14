import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { AskAssistantDto, AssistantAnswerDto } from './dto/assistant.dto';

const ASK_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle(ASK_THROTTLE)
  @ApiOperation({
    summary: 'Ask the configured model about the food and activity of a period',
    description:
      'Sends the log for the period with the conversation to the stored provider and returns its answer.',
  })
  @ApiOkResponse({ type: AssistantAnswerDto })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskAssistantDto,
  ): Promise<AssistantAnswerDto> {
    return this.assistant.ask(user.id, dto);
  }
}
