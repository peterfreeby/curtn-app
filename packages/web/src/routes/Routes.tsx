import { Home } from '../pages/Home/Home'
import { Login } from '../pages/Login/Login'
import { AuthRequired } from './AuthRequired'
import { SignUp } from '../pages/SignUp/SignUp'
import { Review } from '../pages/Review/Review'
import { Profile } from '../pages/Profile/Profile'
import { NoMatch } from '../pages/NoMatch/NoMatch'
import { NewReview } from '../pages/NewReview/NewReview'
import { Routes as RRoutes, Route } from 'react-router-dom'
// Updated import - Performance instead of Movie
import { PerformanceDetails } from '../pages/PerformanceDetails/PerformanceDetails'
// Keep the old search for now until we update it
import { SearchMovieFromTMDB } from '../pages/SearchMovieFromTMDB/SearchMovieFromTMDB'

export const Routes = () => {
  return (
    <RRoutes>
      <Route
        path="/"
        element={
          <AuthRequired>
            <Home />
          </AuthRequired>
        }
      />
      <Route
        path={'profile'}
      >
        <Route
          path={':username'}
          element={
            <Profile />
          }
        />
      </Route>
      <Route
        path="review"
      >
        <Route
          path={'new'}
          element={
            <AuthRequired>
              <NewReview />
            </AuthRequired>
          }
        />
        <Route
          path={':id'}
          element={
            <Review />
          }
        />
      </Route>
      <Route
        path="/search-movie"
        element={
          <AuthRequired>
            <SearchMovieFromTMDB searchQueryRef={{}} />
          </AuthRequired>
        }
      />
      {/* Updated route - performance instead of movie */}
      <Route
        path="/performance"
      >
        <Route path=":performanceId" element={<PerformanceDetails />} />
      </Route>
      <Route path="/signUp" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NoMatch />} />
    </RRoutes >
  )
}