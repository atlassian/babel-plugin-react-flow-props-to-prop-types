// @flow
import pluginTester from 'babel-plugin-tester';
import plugin from '../index';
import stripIndent from 'strip-indent';
import path from 'path';

function stripIndents(tests) {
  return tests.map(test => {
    if (test.code) test.code = stripIndent(test.code);
    if (test.output) test.output = stripIndent(test.output);
    return test;
  });
}

pluginTester({
  plugin: plugin,
  babelOptions: {
    parserOpts: {plugins: ['flow']},
  },
  tests: stripIndents([
    // prop types
    {
      title: 'any',
      code: `
        class Foo extends React.Component {
          props: {
            a: any
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: any
          };
          static propTypes = {
            a: _PropTypes.any.isRequired
          };
        }
      `,
    },
    {
      title: 'mixed',
      code: `
        class Foo extends React.Component {
          props: {
            a: mixed
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: mixed
          };
          static propTypes = {
            a: _PropTypes.any.isRequired
          };
        }
      `,
    },
    {
      title: 'number',
      code: `
        class Foo extends React.Component {
          props: {
            a: number
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: number
          };
          static propTypes = {
            a: _PropTypes.number.isRequired
          };
        }
      `,
    },
    {
      title: 'boolean',
      code: `
        class Foo extends React.Component {
          props: {
            a: boolean
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: boolean
          };
          static propTypes = {
            a: _PropTypes.bool.isRequired
          };
        }
      `,
    },
    {
      title: 'string',
      code: `
        class Foo extends React.Component {
          props: {
            a: string
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: string
          };
          static propTypes = {
            a: _PropTypes.string.isRequired
          };
        }
      `,
    },
    {
      title: 'null',
      code: `
        class Foo extends React.Component {
          props: {
            a: null
          };
        }
      `,
      error: true,
    },
    {
      title: 'void',
      code: `
        class Foo extends React.Component {
          props: {
            a: void
          };
        }
      `,
      error: true,
    },
    {
      title: 'number literal',
      code: `
        class Foo extends React.Component {
          props: {
            a: 1
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: 1
          };
          static propTypes = {
            a: _PropTypes.number.isRequired
          };
        }
      `,
    },
    {
      title: 'boolean literal',
      code: `
        class Foo extends React.Component {
          props: {
            a: true
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: true
          };
          static propTypes = {
            a: _PropTypes.bool.isRequired
          };
        }
      `,
    },
    {
      title: 'string literal',
      code: `
        class Foo extends React.Component {
          props: {
            a: "three"
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: "three"
          };
          static propTypes = {
            a: _PropTypes.string.isRequired
          };
        }
      `,
    },
    {
      title: 'array',
      code: `
        class Foo extends React.Component {
          props: {
            a: string[]
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: string[]
          };
          static propTypes = {
            a: _PropTypes.arrayOf(_PropTypes.string).isRequired
          };
        }
      `,
    },
    {
      title: 'function',
      code: `
        class Foo extends React.Component {
          props: {
            a: () => void
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: () => void
          };
          static propTypes = {
            a: _PropTypes.func.isRequired
          };
        }
      `,
    },
    {
      title: 'maybe',
      code: `
        class Foo extends React.Component {
          props: {
            a: ?boolean
          };
        }
      `,
      error: true,
    },
    {
      title: 'tuple',
      code: `
        class Foo extends React.Component {
          props: {
            a: [number, boolean]
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: [number, boolean]
          };
          static propTypes = {
            a: _PropTypes.array.isRequired
          };
        }
      `,
    },
    {
      title: 'union',
      code: `
        class Foo extends React.Component {
          props: {
            a: number | boolean
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: number | boolean
          };
          static propTypes = {
            a: _PropTypes.oneOf([_PropTypes.number, _PropTypes.bool]).isRequired
          };
        }
      `,
    },

    // references
    {
      title: 'reference type alias',
      code: `
        type a = number;
        class Foo extends React.Component {
          props: {
            a: a
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        type a = number;
        class Foo extends React.Component {
          props: {
            a: a
          };
          static propTypes = {
            a: _PropTypes.number.isRequired
          };
        }
      `,
    },
    {
      title: 'reference interface',
      code: `
        interface a {}
        class Foo extends React.Component {
          props: {
            a: a
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        interface a {}
        class Foo extends React.Component {
          props: {
            a: a
          };
          static propTypes = {
            a: _PropTypes.shape({}).isRequired
          };
        }
      `,
    },
    {
      title: 'reference class',
      code: `
        class a {}
        class Foo extends React.Component {
          props: {
            a: a
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class a {}
        class Foo extends React.Component {
          props: {
            a: a
          };
          static propTypes = {
            a: _PropTypes.instanceOf(a).isRequired
          };
        }
      `,
    },
    {
      title: 'reference props',
      code: `
        type Props = {
          a: any
        };
        class Foo extends React.Component {
          props: Props;
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        type Props = {
          a: any
        };
        class Foo extends React.Component {
          props: Props;
          static propTypes = {
            a: _PropTypes.any.isRequired
          };
        }
      `,
    },

    // comments
    {
      title: 'comments',
      code: `
        class Foo extends React.Component {
          props: {
            // This is the a prop
            a: any
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            // This is the a prop
            a: any
          };
          static propTypes = {
            // This is the a prop
            a: _PropTypes.any.isRequired
          };
        }
      `,
    },
    {
      title: 'nested comments',
      code: `
        class Foo extends React.Component {
          props: {
            a: {
              // This is the a.b prop
              b: any
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: {
              // This is the a.b prop
              b: any
            }
          };
          static propTypes = {
            a: _PropTypes.shape({
              // This is the a.b prop
              b: _PropTypes.any.isRequired
            }).isRequired
          };
        }
      `,
    },
  ]),
});

pluginTester({
  plugin: plugin,
  babelOptions: {
    parserOpts: {plugins: ['flow']},
  },
  fixtures: path.join(__dirname, '..', '..', 'fixtures'),
});
