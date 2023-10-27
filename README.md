# `derive-zustand`

A function to create a derived Zustand store from many input stores.

**Comparision with [dai-shi/derive-zustand](https://github.com/dai-shi/derive-zustand)**:

This `derive-zustand`'s `deriveFn` (`onChange`) takes two additional arguments:
- Previous states of the dependant stores
- Previous state of the derived store itself

Example usage:

```typescript
const depStore1 = create<{
  value: number[];
}>(() => ({
  value: [1],
}));

const depStore2 = create<{
  value: number[];
}>(() => ({
  value: [2],
}));

const deriveStore = derive<string, [typeof depStore1, typeof depStore2]>(
  [depStore1, depStore2],
  ([dep1, dep2], prevDeps, prevState) => {
    return `${dep1} ${dep2}`;
  }
);
```
