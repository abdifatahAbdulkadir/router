/* @refresh reload */
import { For, render } from 'solid-js/web'

import {
  Outlet,
  RouterProvider,
  createSolidRouter,
  createRouteConfig,
} from '@tanstack/solid-router'
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import axios from 'axios'

type PostType = {
  id: string
  title: string
  body: string
}

const routeConfig = createRouteConfig().createChildren((createRoute) => [
  createRoute({
    path: '/',
    element: Index,
  }),
  createRoute({
    path: 'posts',
    element: Posts,
    errorElement: () => 'Oh crap!',
    loader: async () => {
      return {
        posts: await fetchPosts(),
      }
    },
  }).createChildren((createRoute) => [
    createRoute({ path: '/', element: PostsIndex }),
    createRoute({
      path: ':postId',
      element: Post,
      loader: async ({ params: { postId } }) => {
        return {
          post: await fetchPostById(postId),
        }
      },
    }),
  ]),
])

// Set up a ReactRouter instance
const router = createSolidRouter({
  routeConfig,
  // defaultPreload: 'intent',
})

function App() {
  return (
    // Build our routes and render our router
    <>
      <RouterProvider router={router}>
        <div>
          <router.Link
            to="/"
            activeProps={{
              class: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </router.Link>{' '}
          <router.Link
            to="/posts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Posts
          </router.Link>
        </div>
        <hr />
        <Outlet /> {/* Start rendering router matches */}
      </RouterProvider>
      {/* <TanStackRouterDevtools router={router} position="bottom-right" /> */}
    </>
  )
}

async function fetchPosts() {
  console.log('Fetching posts...')
  await new Promise((r) => setTimeout(r, 500))
  return axios
    .get<PostType[]>('https://jsonplaceholder.typicode.com/posts')
    .then((r) => r.data.slice(0, 10))
}

async function fetchPostById(postId: string) {
  console.log(`Fetching post with id ${postId}...`)
  await new Promise((r) => setTimeout(r, 500))

  return await axios
    .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
    .then((r) => r.data)
}

function Index() {
  return (
    <div>
      <h3>Welcome Home!</h3>
    </div>
  )
}

function Posts() {
  const {
    loaderData, // TODO reactivity
    Link,
  } = router.useMatch('/posts')

  return (
    <div>
      <div
        style={{
          float: 'left',
          'margin-right': '1rem',
        }}
      >
        <For each={loaderData.posts}>
          {(post) => {
            return (
              <div>
                <Link
                  to="/posts/:postId"
                  params={{
                    postId: post.id,
                  }}
                  activeProps={{ class: 'font-bold' }}
                >
                  <pre>{post.title.substring(0, 20)}</pre>
                </Link>
              </div>
            )
          }}
        </For>
      </div>
      <hr />
      <Outlet />
    </div>
  )
}

function PostsIndex() {
  return (
    <>
      <div>Select a post.</div>
    </>
  )
}

function Post() {
  const {
    loaderData: { post },
  } = router.useMatch('/posts/:postId')

  return (
    <div>
      <h4>{post.title}</h4>
      <p>{post.body}</p>
    </div>
  )
}
render(() => <App />, document.getElementById('root'))
