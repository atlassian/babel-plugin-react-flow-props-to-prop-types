# babel-plugin-react-flow-props-to-prop-types

> Convert Flow React props annotation to PropTypes

## Example

In:

```js
class MyComponent extends React.Component {
  props: {
    className: string
  };

  // ...
}
```

Out:

```js
class MyComponent extends React.Component {
  props: {
    className: string
  };
  static propTypes = {
    className: PropTypes.string.isRequired
  };

  // ...
}
```

## Installation

```sh
$ npm install react-flow-props-to-prop-types
```

## Usage

### Via `.babelrc` (Recommended)

**.babelrc**

```json
{
  "plugins": ["react-flow-props-to-prop-types"]
}
```

### Via CLI

```sh
$ babel --plugins react-flow-props-to-prop-types script.js
```

### Via Node API

```javascript
require("babel-core").transform("code", {
  plugins: ["react-flow-props-to-prop-types"]
});
```
