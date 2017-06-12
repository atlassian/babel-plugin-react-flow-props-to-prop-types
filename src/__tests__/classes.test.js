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
      title: 'object type spread',
      code: `
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {
              b: any,
              ...C
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {
              b: any;
              ...C;
            }
          };
          static propTypes = {
            a: _PropTypes.shape({
              b: _PropTypes.any.isRequired,
              c: _PropTypes.any
            }).isRequired
          };
        }
      `,
    },
    {
      title: 'object type spread exact',
      code: `
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {
              b: any,
              ...$Exact<C>
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {
              b: any;
              ...$Exact<C>;
            }
          };
          static propTypes = {
            a: _PropTypes.shape({
              b: _PropTypes.any.isRequired,
              c: _PropTypes.any.isRequired
            }).isRequired
          };
        }
      `,
    },
    {
      title: 'object type spread exact shorthand',
      code: `
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {| ...C |}
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        type C = {
          c: any
        };
        class Foo extends React.Component {
          props: {
            a: {| ...C |}
          };
          static propTypes = {
            a: _PropTypes.shape({
              c: _PropTypes.any.isRequired
            }).isRequired
          };
        }
      `,
    },
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
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: null
          };
          static propTypes = {
            a: _PropTypes.oneOf([null]).isRequired
          };
        }
      `,
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
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: void
          };
          static propTypes = {
            a: _PropTypes.oneOf([undefined]).isRequired
          };
        }
      `,
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
            a: _PropTypes.oneOf([1]).isRequired
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
            a: _PropTypes.oneOf([true]).isRequired
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
            a: _PropTypes.oneOf(["three"]).isRequired
          };
        }
      `,
    },
    {
      title: 'object',
      code: `
        class Foo extends React.Component {
          props: {
            a: {
              b: any,
              "c": any,
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: {
              b: any;
              "c": any;
            }
          };
          static propTypes = {
            a: _PropTypes.shape({
              b: _PropTypes.any.isRequired,
              "c": _PropTypes.any.isRequired
            }).isRequired
          };
        }
      `,
    },
    {
      title: 'indexers',
      code: `
        class Foo extends React.Component {
          props: {
            a: {
              [a: string]: any
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: {
              [a: string]: any
            }
          };
          static propTypes = {
            a: _PropTypes.objectOf(_PropTypes.any).isRequired
          };
        }
      `,
    },
    {
      title: 'call properties',
      code: `
        class Foo extends React.Component {
          props: {
            (): any;
          };
        }
      `,
      error: true,
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
      title: 'maybe object value',
      code: `
        class Foo extends React.Component {
          props: {
            a: ?boolean
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: ?boolean
          };
          static propTypes = {
            a: _PropTypes.bool
          };
        }
      `,
    },
    {
      title: 'maybe nested object value',
      code: `
        class Foo extends React.Component {
          props: {
            a: {
              b: ?boolean
            }
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: {
              b: ?boolean
            }
          };
          static propTypes = {
            a: _PropTypes.shape({
              b: _PropTypes.bool
            }).isRequired
          };
        }
      `,
    },
    {
      title: 'maybe non-object value',
      code: `
        class Foo extends React.Component {
          props: {
            a: Array<?boolean>
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: Array<?boolean>
          };
          static propTypes = {
            a: _PropTypes.arrayOf(_PropTypes.oneOf([null, undefined, _PropTypes.bool])).isRequired
          };
        }
      `,
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
            a: _PropTypes.oneOfType([_PropTypes.number, _PropTypes.bool]).isRequired
          };
        }
      `,
    },
    {
      title: 'union literals',
      code: `
        class Foo extends React.Component {
          props: {
            a: 1 | true | "three" | null | void
          };
        }
      `,
      output: `
        import _PropTypes from \"prop-types\";
        class Foo extends React.Component {
          props: {
            a: 1 | true | \"three\" | null | void
          };
          static propTypes = {
            a: _PropTypes.oneOf([1, true, \"three\", null, undefined]).isRequired
          };
        }
      `,
    },
    {
      title: 'intersection',
      code: `
        class Foo extends React.Component {
          props: {
            a: number & boolean
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        import _all from "prop-types-extra/lib/all";
        class Foo extends React.Component {
          props: {
            a: number & boolean
          };
          static propTypes = {
            a: _all(_PropTypes.number, _PropTypes.bool).isRequired
          };
        }
      `,
    },
    {
      title: 'Function',
      code: `
        class Foo extends React.Component {
          props: {
            a: Function
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: Function
          };
          static propTypes = {
            a: _PropTypes.func.isRequired
          };
        }
      `,
    },
    {
      title: 'Object',
      code: `
        class Foo extends React.Component {
          props: {
            a: Object
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: Object
          };
          static propTypes = {
            a: _PropTypes.object.isRequired
          };
        }
      `,
    },
    {
      title: 'Array',
      code: `
        class Foo extends React.Component {
          props: {
            a: Array<number>
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: {
            a: Array<number>
          };
          static propTypes = {
            a: _PropTypes.arrayOf(_PropTypes.number).isRequired
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
    {
      title: 'PropTypes replacement',
      code: `
        import type { PropType } from "babel-plugin-react-flow-props-to-prop-types";

        class Foo extends React.Component {
          props: {
            a: PropType<UnknownFunctionType, Function>
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        import type { PropType } from "babel-plugin-react-flow-props-to-prop-types";

        class Foo extends React.Component {
          props: {
            a: PropType<UnknownFunctionType, Function>
          };
          static propTypes = {
            a: _PropTypes.func.isRequired
          };
        }
      `,
    },
    {
      title: 'top-level intersection objects',
      code: `
        class Foo extends React.Component {
          props: { foo: boolean } & { bar: boolean };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        class Foo extends React.Component {
          props: { foo: boolean } & { bar: boolean };
          static propTypes = {
            foo: _PropTypes.bool.isRequired,
            bar: _PropTypes.bool.isRequired
          };
        }
      `,
    },
    {
      title: 'top-level intersection non-objects',
      code: `
        class Foo extends React.Component {
          props: boolean & number;
        }
      `,
      error: true,
    },
    {
      title: 'HasDefaultProp',
      code: `
        import type { HasDefaultProp } from "babel-plugin-react-flow-props-to-prop-types";

        class Foo extends React.Component {
          props: {
            a: HasDefaultProp<Function>
          };
        }
      `,
      output: `
        import _PropTypes from "prop-types";
        import type { HasDefaultProp } from "babel-plugin-react-flow-props-to-prop-types";

        class Foo extends React.Component {
          props: {
            a: HasDefaultProp<Function>
          };
          static propTypes = {
            a: _PropTypes.func
          };
        }
      `,
    },
    {
      title: 'HasDefaultProp error',
      code: `
        import type { HasDefaultProp } from "babel-plugin-react-flow-props-to-prop-types";

        class Foo extends React.Component {
          props: {
            a: { b: HasDefaultProp<Function> }
          };
        }
      `,
      error: true,
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
