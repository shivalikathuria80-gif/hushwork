// A tiny shared note between the story film (StoryScene) and the 3D dot sea (HeroScene), so the background
// reacts to the story: the sea gets rough and reddish during the chaos, calms down for the mind map, and a
// green ripple rolls out when the tick lands. Written every frame by StoryScene, read every frame by HeroScene.
export const storyState = { chaos: 0, calm: 0, done: 0, pointerX: 0, pointerY: 0 };
