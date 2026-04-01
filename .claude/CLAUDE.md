# Guidance for writing code for Claude

## Avoid multiple parameters of the same type

When you have a function with more than one parameter with the same type (i.e. string). Instead, use an object parameter instead of positional parameters.

```ts
// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
```

all method names should use camelCase, and boolean-returning methods should be prefixed with "is" or "has" to indicate their purpose. For example, `isLessonBookmarked` is a good name for a method that checks if a lesson is bookmarked, while `toggleBookmark` is appropriate for a method that toggles the bookmark state.

```ts
// BAD
const happy_user = (userId: string) => {
    return `User ${userId} is happy!`;
};

const is_happy = (userId: string) => {
    return true;
};

const spiky = (attribute: string) => {
    return !!attribute === 'spikes';
};

// GOOD
const happyUser = (userId: string) => {
    return `User ${userId} is happy!`;
};

const isHappy = (userId: string) => {
    return true;
};

const hasSpikes = (attribute: string) => {
    return !!attribute === 'spikes';
};
```

Anything marked as a `service` by in the name of the file such as `authTokenService.ts` should have tests written for them to get to 100% code coverage in an accompanying `*.test.ts` file. Services are the core business logic of the application and should be thoroughly tested to ensure reliability and maintainability.