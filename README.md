# babel-plugin-react-flow-props-to-prop-types

> Convert Flow React `props` and `contextTypes` annotation to PropTypes

- Supports most Flow types (see below)
- Maintains comments
- Works across modules (can import types)

**Supported:**

- `any/mixed` Unknown types
- `void/null` Empty types
- `number / string / boolean` Primitives
- `42 / "hello" / true` Literals
- `[1, 2, 3]` Tuples
- `{ ... }` Objects
  - `{ prop: number }` Object Properties
  - `{ prop?: number }` Optional properties
  - `{ [prop: string]: number }` Optional Indexers
- `{ [key: string]: number }` Object indexers
- `Array<string>` Arrays
- `Object` Unknown Objects
- `Function` Unknown Functions
- `boolean | string` Unions
- `{ foo: number } & { bar: string }` Intersections
- Referencing other types:
  - `type Alias = number` - Type Aliases
  - `interface Stuff {}` - Interfaces
  - `class Thing {}` - Class Declarations
  - `import type {Alias} from "./other";` Type imports
  - `...Other` and `...$Exact<Other>` - Object type spreads

**Unsupported:**

- `{ a: number, [b: string]: number }` Combining properties and indexers
- `{ [a: string]: number, [b: string]: number }` Multiple indexers
- `{ (): void }` Object call properties
- `a.b` Qualified type identifiers
- `import typeof Export from "./other";` Typeof imports

## Example

In:

```js
class MyComponent extends React.Component {
  contextTypes: {
    theme: Object
  };
  props: {
    // Add a class name to the root element
    className: string
  };

  // ...
}
```

Out:

```js
class MyComponent extends React.Component {
  contextTypes: {
    theme: Object
  };
  static contextTypes = {
    PropTypes.object.isRequired
  };
  props: {
    // Add a class name to the root element
    className: string
  };
  static propTypes = {
    // Add a class name to the root element
    className: PropTypes.string.isRequired
  };

  // ...
}
```

## Installation

```sh
$ yarn add prop-types prop-types-extra
$ yarn add --dev babel-plugin-react-flow-props-to-prop-types
```

> **Note:** [`prop-types-extra`](https://github.com/react-bootstrap/prop-types-extra)
> is necessary for intersection type support.

## Usage

### Via `.babelrc` (Recommended)

**.babelrc**

```js
{
  "plugins": [
    ["react-flow-props-to-prop-types", { /* options */ }]
  ]
}
```

### Via CLI

```sh
$ babel --plugins react-flow-props-to-prop-types script.js
```

### Via Node API

```javascript
require("babel-core").transform("code", {
  plugins: [
    ["react-flow-props-to-prop-types", { /* options */ }]
  ]
});
```

## Options

### `resolveOpts` (optional)

Passed through to [node-resolve](https://github.com/substack/node-resolve)
