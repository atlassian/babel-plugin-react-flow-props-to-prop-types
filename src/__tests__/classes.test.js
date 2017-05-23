import pluginTester from 'babel-plugin-tester';
import plugin from '../index';
import stripIndent from 'strip-indent';

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
    // matching
    {
      title: 'dont match no super class',
      code: `
        class Foo {
          props: {};
        }
      `,
      output: `
        class Foo {
          props: {};
        }
      `,
    },
    {
      title: 'dont match super class not react',
      code: `
        class Foo extends Bar {
          props: {};
        }
      `,
      output: `
        class Foo extends Bar {
          props: {};
        }
      `,
    },
    {
      title: 'dont match super class member expression not react',
      code: `
        class Foo extends Bar.Baz {
          props: {};
        }
      `,
      output: `
        class Foo extends Bar.Baz {
          props: {};
        }
      `,
    },
    {
      title: 'dont match super class member expression react not component',
      code: `
        class Foo extends React.Baz {
          props: {};
        }
      `,
      output: `
        class Foo extends React.Baz {
          props: {};
        }
      `,
    },
    {
      title: 'match super class member expression react component',
      code: `
        class Foo extends React.Component {
          props: {};
        }
      `,
      output: `
        class Foo extends React.Component {
          static propTypes = {};
        }
      `,
    },
    {
      title: 'match super class member expression react pure component',
      code: `
        class Foo extends React.Component {
          props: {};
        }
      `,
      output: `
        class Foo extends React.Component {
          static propTypes = {};
        }
      `,
    },

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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.any.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.any.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.number.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.bool.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.string.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.number.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.bool.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.string.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.arrayOf(PropTypes.string).isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.func.isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.array.isRequired
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
        type a = number;
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.number.isRequired
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
        interface a {}
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.shape({}).isRequired
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
        class a {}
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.instanceOf(a).isRequired
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
        class Foo extends React.Component {
          static propTypes = {
            // This is the a prop
            a: PropTypes.any.isRequired
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
          }
        }
      `,
      output: `
        class Foo extends React.Component {
          static propTypes = {
            a: PropTypes.shape({
              // This is the a.b prop
              b: PropTypes.any.isRequired
            }).isRequired
          };
        }
      `,
    },
  ]),
});
