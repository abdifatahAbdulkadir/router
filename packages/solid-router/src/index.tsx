// jsxImportSource solid-js

import {
  Accessor,
  Component,
  createContext,
  createEffect,
  createSignal,
  ErrorBoundary,
  JSX,
  mergeProps,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import { createStore, reconcile, Store } from 'solid-js/store'

import {
  AnyRoute,
  CheckId,
  rootRouteId,
  Router,
  RouterState,
  ToIdOption,
  warning,
  RouterOptions,
  RouteMatch,
  MatchRouteOptions,
  RouteConfig,
  AnyRouteConfig,
  AnyAllRouteInfo,
  DefaultAllRouteInfo,
  functionalUpdate,
  createRouter,
  AnyRouteInfo,
  AllRouteInfo,
  RouteInfo,
  ValidFromPath,
  LinkOptions,
  RouteInfoByPath,
  ResolveRelativePath,
  NoInfer,
  ToOptions,
  invariant,
} from '@tanstack/router-core'

export * from '@tanstack/router-core'

interface Preloadable {
  preload: () => Promise<Component>
}

declare module '@tanstack/router-core' {
  interface FrameworkGenerics {
    Element: Component
    // Any is required here so import() will work without having to do import().then(d => d.default)
    SyncOrAsyncElement: Component | (Component & Preloadable)
  }

  interface Router<
    TRouteConfig extends AnyRouteConfig = RouteConfig,
    TAllRouteInfo extends AnyAllRouteInfo = AllRouteInfo<TRouteConfig>,
  > {
    useState: () => Store<RouterState>
    useRoute: <TId extends keyof TAllRouteInfo['routeInfoById']>(
      routeId: TId,
    ) => Route<TAllRouteInfo, TAllRouteInfo['routeInfoById'][TId]>
    useMatch: <TId extends keyof TAllRouteInfo['routeInfoById']>(
      routeId: TId,
    ) => RouteMatch<TAllRouteInfo, TAllRouteInfo['routeInfoById'][TId]>
    linkProps: <TTo extends string = '.'>(
      props: LinkPropsOptions<TAllRouteInfo, '/', TTo> &
        JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
    ) => JSX.AnchorHTMLAttributes<HTMLAnchorElement>
    Link: <TTo extends string = '.'>(
      props: LinkPropsOptions<TAllRouteInfo, '/', TTo> &
        JSX.AnchorHTMLAttributes<HTMLAnchorElement> &
        Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
          // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
          children?:
            | JSX.Element
            | ((state: { isActive: boolean }) => JSX.Element)
        },
    ) => JSX.Element
    MatchRoute: <TTo extends string = '.'>(
      props: ToOptions<TAllRouteInfo, '/', TTo> &
        MatchRouteOptions & {
          // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
          children?:
            | JSX.Element
            | ((
                params: RouteInfoByPath<
                  TAllRouteInfo,
                  ResolveRelativePath<'/', NoInfer<TTo>>
                >['allParams'],
              ) => JSX.Element)
        },
    ) => JSX.Element
  }

  interface Route<
    TAllRouteInfo extends AnyAllRouteInfo = DefaultAllRouteInfo,
    TRouteInfo extends AnyRouteInfo = RouteInfo,
  > {
    useRoute: <
      TTo extends string = '.',
      TResolved extends string = ResolveRelativePath<
        TRouteInfo['id'],
        NoInfer<TTo>
      >,
    >(
      routeId: CheckId<
        TAllRouteInfo,
        TResolved,
        ToIdOption<TAllRouteInfo, TRouteInfo['id'], TTo>
      >,
    ) => Route<TAllRouteInfo, TAllRouteInfo['routeInfoById'][TResolved]>
    linkProps: <TTo extends string = '.'>(
      props: LinkPropsOptions<TAllRouteInfo, TRouteInfo['fullPath'], TTo> &
        JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
    ) => JSX.AnchorHTMLAttributes<HTMLAnchorElement>
    Link: <TTo extends string = '.'>(
      props: LinkPropsOptions<TAllRouteInfo, TRouteInfo['fullPath'], TTo> &
        JSX.AnchorHTMLAttributes<HTMLAnchorElement> &
        Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
          // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
          children?:
            | JSX.Element
            | ((state: { isActive: boolean }) => JSX.Element)
        },
    ) => JSX.Element
    MatchRoute: <TTo extends string = '.'>(
      props: ToOptions<TAllRouteInfo, TRouteInfo['fullPath'], TTo> &
        MatchRouteOptions & {
          // If a function is passed as a child, it will be given the `isActive` boolean to aid in further styling on the element it returns
          children?:
            | JSX.Element
            | ((
                params: RouteInfoByPath<
                  TAllRouteInfo,
                  ResolveRelativePath<TRouteInfo['fullPath'], NoInfer<TTo>>
                >['allParams'],
              ) => JSX.Element)
        },
    ) => JSX.Element
  }
}

type LinkPropsOptions<
  TAllRouteInfo extends AnyAllRouteInfo = DefaultAllRouteInfo,
  TFrom extends ValidFromPath<TAllRouteInfo> = '/',
  TTo extends string = '.',
> = LinkOptions<TAllRouteInfo, TFrom, TTo> & {
  // A function that returns additional props for the `active` state of this link. These props override other props passed to the link (`style`'s are merged, `class`'s are concatenated)
  activeProps?:
    | JSX.AnchorHTMLAttributes<HTMLAnchorElement>
    | (() => JSX.AnchorHTMLAttributes<HTMLAnchorElement>)
  // A function that returns additional props for the `inactive` state of this link. These props override other props passed to the link (`style`'s are merged, `class`'s are concatenated)
  inactiveProps?:
    | JSX.AnchorHTMLAttributes<HTMLAnchorElement>
    | (() => JSX.AnchorHTMLAttributes<HTMLAnchorElement>)
}

export type PromptProps = {
  message: string
  when?: boolean | any
  children?: JSX.Element
}

//

const matchesContext = createContext<RouteMatch[]>(null!)
const routerContext = createContext<Router<any, any>>(null!)

// Detect if we're in the DOM
const isDOM = Boolean(
  typeof window !== 'undefined' &&
    window.document &&
    window.document.createElement,
)

export type MatchesProviderProps = {
  value: RouteMatch[]
  children: JSX.Element
}

export function MatchesProvider(props: MatchesProviderProps) {
  return (
    <matchesContext.Provider value={props.value} children={props.children} />
  )
}

const useRouterState = (router: Router<any, any>) => {
  const [store, setStore] = createStore(router.state)

  router.subscribe((router) => {
    setStore(reconcile(router.state))
  })

  return store
}

export function createSolidRouter<
  TRouteConfig extends AnyRouteConfig = RouteConfig,
>(opts: RouterOptions<TRouteConfig>): Router<TRouteConfig> {
  const makeRouteExt = (
    route: AnyRoute,
    router: Router<any, any>,
  ): Pick<AnyRoute, 'useRoute' | 'linkProps' | 'Link' | 'MatchRoute'> => {
    return {
      useRoute: (subRouteId = '.' as any) => {
        const resolvedRouteId = router.resolvePath(
          route.routeId,
          subRouteId as string,
        )
        const resolvedRoute = router.getRoute(resolvedRouteId)
        useRouterState(router) // TODO
        invariant(
          resolvedRoute,
          `Could not find a route for route "${
            resolvedRouteId as string
          }"! Did you forget to add it to your route config?`,
        )
        return resolvedRoute
      },
      linkProps: (options) => {
        const [, rest] = splitProps(
          mergeProps(
            {
              activeProps: () => ({ class: 'active' }),
              inactiveProps: () => ({}),
            },
            options,
          ),
          [
            'type',
            'children',
            'target',
            'activeProps',
            'inactiveProps',
            'activeOptions',
            'disabled',
            'hash',
            'search',
            'params',
            'to',
            'preload',
            'preloadDelay',
            'preloadMaxAge',
            'replace',
            'style',
            'class',
            'onClick',
            'onFocus',
            'onMouseEnter',
            'onMouseLeave',
            'onTouchStart',
            'onTouchEnd',
          ],
        )

        const linkInfo = route.buildLink(options)

        if (linkInfo.type === 'external') {
          return {
            get href() {
              return linkInfo.href
            },
          } as JSX.AnchorHTMLAttributes<HTMLAnchorElement>
        }

        const {
          handleClick,
          handleFocus,
          handleEnter,
          handleLeave,
          isActive,
          next,
        } = linkInfo

        const composeHandlers =
          (handlers: (undefined | JSX.EventHandlerUnion<any, any>)[]) =>
          (e: Event) => {
            handlers.forEach((handler) => {
              if (handler) {
                if (Array.isArray(handler)) {
                  return handler[0](handler[1], e)
                }

                if (typeof handler === 'function') {
                  handler(e)
                }
              }
            })
          }

        // Get the active props
        const resolvedActiveProps: JSX.HTMLAttributes<HTMLAnchorElement> =
          isActive ? functionalUpdate(options.activeProps, {}) ?? {} : {}

        // Get the inactive props
        const resolvedInactiveProps: JSX.HTMLAttributes<HTMLAnchorElement> =
          isActive ? {} : functionalUpdate(options.inactiveProps, {}) ?? {}

        return mergeProps(resolvedActiveProps, resolvedInactiveProps, rest, {
          href: (options.disabled ? undefined : next.href) as any,
          onClick: composeHandlers([handleClick, options.onClick]),
          onFocus: composeHandlers([handleFocus, options.onFocus]),
          onMouseEnter: composeHandlers([handleEnter, options.onMouseEnter]),
          onMouseLeave: composeHandlers([handleLeave, options.onMouseLeave]),
          target: options.target,
          get style() {
            return {
              ...(options.style as {}),
              ...(resolvedActiveProps.style as {}),
              ...(resolvedInactiveProps.style as {}),
            }
          },
          class:
            [
              options.class,
              resolvedActiveProps.class,
              resolvedInactiveProps.class,
            ]
              .filter(Boolean)
              .join(' ') || undefined,
          ...(options.disabled
            ? {
                role: 'link',
                'aria-disabled': true,
              }
            : undefined),
          ['data-status']: isActive ? 'active' : undefined,
        }) as any
      },
      Link: (props: any) => {
        const [linkProps, setLinkProps] = createSignal(route.linkProps(props))

        const state = useRouterState(router)

        createEffect(() => {
          JSON.stringify(state)
          setLinkProps(route.linkProps(props))
        })

        return (
          <a
            {...linkProps()}
            children={
              typeof props.children === 'function'
                ? props.children({
                    get isActive() {
                      return (linkProps as any)['data-status'] === 'active'
                    },
                  })
                : props.children
            }
          />
        )
      },
      MatchRoute: (opts) => {
        const [, rest] = splitProps(opts, [
          'pending',
          'caseSensitive',
          'children',
        ])

        const [params, setParams] = createSignal(
          route.matchRoute(rest as any, opts),
        )

        const state = useRouterState(router)

        createEffect(() => {
          JSON.stringify(state)
          setParams(route.matchRoute(rest as any, opts))
        })

        return () => {
          if (!params()) {
            return null
          }

          return typeof opts.children === 'function'
            ? opts.children(params as any)
            : (opts.children as any)
        }
      },
    }
  }

  const coreRouter = createRouter<TRouteConfig>({
    ...opts,
    createRouter: (router) => {
      const routerExt: Pick<Router<any, any>, 'useMatch' | 'useState'> = {
        useState: () => {
          return useRouterState(router)
        },
        useMatch: (routeId) => {
          invariant(
            routeId !== rootRouteId,
            `"${rootRouteId}" cannot be used with useMatch! Did you mean to useRoute("${rootRouteId}")?`,
          )

          const runtimeMatch = useMatch()

          const [match, setMatch] = createSignal(
            router.state.matches.find((d) => d.routeId === routeId),
          )

          const state = useRouterState(router)

          createEffect(() => {
            JSON.stringify(state)
            setMatch(router.state.matches.find((d) => d.routeId === routeId))
          })

          const m = match()

          invariant(
            m,
            `Could not find a match for route "${
              routeId as string
            }" being rendered in this component!`,
          )

          invariant(
            runtimeMatch.routeId == m?.routeId,
            `useMatch('${
              m?.routeId as string
            }') is being called in a component that is meant to render the '${
              runtimeMatch.routeId
            }' route. Did you mean to 'useRoute(${
              m?.routeId as string
            })' instead?`,
          )

          if (!m) {
            invariant('Match not found!')
          }

          return m
        },
      }

      const routeExt = makeRouteExt(router.getRoute('/'), router)

      Object.assign(router, routerExt, routeExt)
    },
    createRoute: ({ router, route }) => {
      const routeExt = makeRouteExt(route, router)

      Object.assign(route, routeExt)
    },
    createElement: async (element) => {
      if ((element as Preloadable).preload) {
        ;(await (element as Preloadable).preload()) as any
      }

      return element
    },
  })

  return coreRouter as any
}

export type RouterProps<
  TRouteConfig extends AnyRouteConfig = RouteConfig,
  TAllRouteInfo extends AnyAllRouteInfo = DefaultAllRouteInfo,
> = RouterOptions<TRouteConfig> & {
  router: Router<TRouteConfig, TAllRouteInfo>
  // Children will default to `<Outlet />` if not provided
  children?: JSX.Element
}

export function RouterProvider<
  TRouteConfig extends AnyRouteConfig = RouteConfig,
  TAllRouteInfo extends AnyAllRouteInfo = DefaultAllRouteInfo,
>(props: RouterProps<TRouteConfig, TAllRouteInfo>) {
  props.router.update(props)

  const state = useRouterState(props.router)

  createEffect(() => {
    onCleanup(props.router.mount())
  })

  return (
    <routerContext.Provider value={props.router}>
      <MatchesProvider value={state.matches}>
        {props.children ?? <Outlet />}
      </MatchesProvider>
    </routerContext.Provider>
  )
}

function useRouter(): Router {
  const value = useContext(routerContext)
  warning(!value, 'useRouter must be used inside a <Router> component!')

  useRouterState(value)

  return value as Router
}

function useMatches(): RouteMatch[] {
  return useContext(matchesContext)
}

// function useParentMatches(): RouteMatch[] {
//   const router = useRouter()
//   const match = useMatch()
//   const matches = router.state.matches
//   return matches.slice(
//     0,
//     matches.findIndex((d) => d.matchId === match.matchId) - 1,
//   )
// }

function useMatch(): RouteMatch {
  return useMatches()?.[0] as RouteMatch
}

export function Outlet() {
  const router = useRouter()
  const [, ...matches] = useMatches()

  const childMatch = matches[0]

  if (!childMatch) return null

  const element = ((): JSX.Element => {
    if (!childMatch) {
      return null
    }

    const errorElement =
      childMatch.__.errorElement ?? router.options.defaultErrorElement

    if (childMatch.status === 'error') {
      if (errorElement) {
        return errorElement as any
      }

      if (
        childMatch.options.useErrorBoundary ||
        router.options.useErrorBoundary
      ) {
        throw childMatch.error
      }

      // return <DefaultErrorBoundary error={childMatch.error} />
    }

    if (childMatch.status === 'loading' || childMatch.status === 'idle') {
      if (childMatch.isPending) {
        const pendingElement =
          childMatch.__.pendingElement ?? router.options.defaultPendingElement

        if (childMatch.options.pendingMs || pendingElement) {
          return (pendingElement as any) ?? null
        }
      }

      return null
    }

    return (childMatch.__.element as any) ?? router.options.defaultElement
  })() as JSX.Element

  const catchElement =
    childMatch?.options.catchElement ?? router.options.defaultCatchElement

  return (
    <MatchesProvider value={matches}>
      {element}
      {/* <CatchBoundary catchElement={catchElement}>{element}</CatchBoundary> */}
    </MatchesProvider>
  )
}

// function CatchBoundary (
//   children: any,
//   catchElement: any
// ) {
//     return <ErrorBoundary fallback={(err, reset) => {

//     }}>

//       </ErrorBoundary>

//       // const catchElement = this.props.catchElement ?? DefaultErrorBoundary

//       // if (this.state.error) {
//       //   return typeof catchElement === 'function'
//       //     ? catchElement(this.state)
//       //     : catchElement
//       // }

//       // return this.props.children
// }

// export function DefaultErrorBoundary({ error }: { error: any }) {
//   return (
//     <div style={{ padding: '.5rem', maxWidth: '100%' }}>
//       <strong style={{ fontSize: '1.2rem' }}>Something went wrong!</strong>
//       <div style={{ height: '.5rem' }} />
//       <div>
//         <pre>
//           {error.message ? (
//             <code
//               style={{
//                 fontSize: '.7em',
//                 border: '1px solid red',
//                 borderRadius: '.25rem',
//                 padding: '.5rem',
//                 color: 'red',
//               }}
//             >
//               {error.message}
//             </code>
//           ) : null}
//         </pre>
//       </div>
//       <div style={{ height: '1rem' }} />
//       <div
//         style={{
//           fontSize: '.8em',
//           borderLeft: '3px solid rgba(127, 127, 127, 1)',
//           paddingLeft: '.5rem',
//           opacity: 0.5,
//         }}
//       >
//         If you are the owner of this website, it's highly recommended that you
//         configure your own custom Catch/Error boundaries for the router. You can
//         optionally configure a boundary for each route.
//       </div>
//     </div>
//   )
// }

// export function usePrompt(message: string, when: boolean | any): void {
//   const router = useRouter()

//   solid.useEffect(() => {
//     if (!when) return

//     let unblock = router.history.block((transition) => {
//       if (window.confirm(message)) {
//         unblock()
//         transition.retry()
//       } else {
//         router.location.pathname = window.location.pathname
//       }
//     })

//     return unblock
//   }, [when, location, message])
// }

// export function Prompt({ message, when, children }: PromptProps) {
//   usePrompt(message, when ?? true)
//   return (children ?? null) as JSX.Element
// }
