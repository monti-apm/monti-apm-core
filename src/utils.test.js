import assert from 'assert';
import { describe, it } from 'mocha';
import { parseAllowedFeaturesHeader } from './utils';

describe('parseAllowedFeaturesHeader', function () {
  it('should ignore whitespace around feature names', function () {
    const features = parseAllowedFeaturesHeader(
      ' websockets, json_line_traces ',
    );

    assert.deepStrictEqual(
      { ...features },
      {
        websockets: true,
        json_line_traces: true,
      },
    );
  });
});
