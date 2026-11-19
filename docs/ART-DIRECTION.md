# KartVerse visual system

## The island race weekend

The landing poster introduces Sunset Island Circuit with a low camera, a broad horizon and the orange kart turning into frame. Large italic lettering sits on the shaded side. Warm light and cool sea separate the three distances in the image. The race hub leads directly to quick race, private rooms, the garage and course selection.

Nintendo's harbor and airport courses make the next destination visible from the driving line. Its stadium and mall provide landmarks at driver height, and its mountain course changes scenery through elevation. Gameloft's Caribbean environments give sea, cliffs and roads distinct silhouettes. Use those principles for an original harbor start, climbing esses, headland turn, gallery and bridge. Keep sight lines clear on both approaches to a corner. [Nintendo course gallery](https://www.nintendo.com/sg/switch/aabp/course/index.html) · [Gameloft Caribbean environment](https://www.gameloft.com/newsroom/asphalt-9-legends-races-to-summer-with-caribbean-4361)

## Materials, typography and components

| Element | Direction |
| --- | --- |
| Ground and surface | #101827 navy base with darker graphite for the header and the page behind illustrations. #182438 lifts panels. Muted slate outlines separate panels. |
| Actions | #FF783D orange for the starting action, active navigation and the circuit signature. #1677FF blue for secondary racing graphics, #20D9E8 for telemetry and #29C982 for ready states. Pair state colors with text or an icon. |
| Lettering | Rajdhani Bold and SemiBold for titles, vehicle names and large buttons. Inter for navigation, labels and running copy. Oxanium for race numbers and timers. Main text #F5F7FA and secondary text #A8B4C5. |
| Layout | Space elements on a 4px grid. Use wide editorial margins on desktop and 16–20px gutters on phones. Use compact rectangular controls, small corner radii and 18–24px outline icons. |
| Identity | A slanted split K, italic wordmark and an orange lane stripe tie navigation, loading, lap timing and results together. |
| Course art | Graphite asphalt with legible edge lines, orange and ivory kerbs, restrained specular highlights, turquoise shallows, shaded palms and mauve distant peaks. Group repeating objects into instances. |
| Preview art | Use original cover art for the featured circuit. Render kart portraits and circuit previews from the actual game geometry. Source route outlines from the same curve as the drivable road. |
| Touch | Anchor independent steering and pedal groups to the safe edges, leave the center free and give each action a visible label. Capture each pointer through release or cancellation. |
| Data | Show loading, empty and unavailable states. Use real room readiness, racer positions and recorded finishes. |

## Implementation sequence

1. Keep the existing React screens, Zustand session state, Three.js engine, custom physics, Supabase and Socket.IO architecture.
2. Apply the shared shell, buttons, course illustrations and typography to the landing page, lobby, garage, records, results and settings.
3. Build the island around a single closed spline. Sample it for road, constraints, AI, cameras, items, grid, gates, signage and minimap.
4. Test controls, track continuity, room lifecycle and two independent clients. Render the interfaces at phone, tablet and desktop sizes before shipping.
