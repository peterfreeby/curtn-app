import {
  Tab,
  Text,
  Box,
  Flex,
  Grid,
  Tabs,
  HStack,
  TabList,
  GridItem,
  TabPanel,
  TabPanels,
  useColorMode,
  VStack,
  Button,
  Divider,
  Badge
} from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import { Header } from '../../components/Header/Header'
import { Footer } from '../../components/Footer/Footer'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { PerformanceDetailsQuery } from './__generated__/PerformanceDetailsQuery.graphql'

export const PerformanceDetails = () => {
  const { colorMode } = useColorMode()
  const { performanceId } = useParams()

  const data = useLazyLoadQuery<PerformanceDetailsQuery>(graphql`
    query PerformanceDetailsQuery ($id: ID!) {
      singlePerformance(id: $id) {
        id
        title
        description
        performanceTypes
        duration
        languages
        company {
          name
          description
        }
        venues {
          id
          name
          address
          city
          coordinates {
            lat
            lng
          }
        }
        upcomingPerformances {
          date
          time
          venue {
            name
            city
          }
          ticketUrl
          soldOut
        }
        averageRating
        reviewCount
      }
    }
  `, { id: performanceId ?? '' })

  const performance = data.singlePerformance

  if (!performance) {
    return (
      <Box
        display={'flex'}
        flexDirection='column'
        gap='0.5em'
        alignItems={'center'}
      >
        <Text>
          Sorry, this performance doesn&apos;t exist
        </Text>
        <Button
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </Box>
    )
  }

  return (
    <Box
      minH={'100vh'}
      h={'100%'}
      w='100%'
      gap={4}
      display={'flex'}
      flexDirection={'column'}
      alignItems={'center'}
    >
      <Header />

      <Grid
        templateColumns='repeat(4, 1fr)'
        p="1em"
        w={['100%', '100%', '48em']}
        gap={5}
        as='main'
      >
        <GridItem
          order={1}
          colSpan={[4, 4]}
          display={['block']}
        >
          <Text
            fontSize={'3xl'}
            fontWeight={'extrabold'}
          >
            {performance.title}
          </Text>
          <HStack
            spacing={2}
            justifyContent={'flex-start'}
            wrap="wrap"
          >
            <Text
              fontSize={'md'}
              color="gray.600"
            >
              by {performance.company.name}
            </Text>
            
            {performance.averageRating && (
              <>
                <span>·</span>
                <Text fontSize={'md'}>
                  {performance.averageRating} ★ ({performance.reviewCount} reviews)
                </Text>
              </>
            )}
          </HStack>

          {/* Performance Types */}
          <HStack spacing={2} mt={2} wrap="wrap">
            {performance.performanceTypes.map((type, index) => (
              <Badge key={index} colorScheme="blue" variant="subtle">
                {type}
              </Badge>
            ))}
          </HStack>
        </GridItem>

        <GridItem
          colSpan={[4, 4]}
          order={2}
        >
          <Text
            textAlign={'justify'}
            fontSize={'md'}
            fontWeight={'medium'}
          >
            {performance.description}
          </Text>
          
          {performance.company.description && (
            <Box mt={4}>
              <Text fontWeight="bold" mb={2}>About {performance.company.name}:</Text>
              <Text fontSize="sm" color="gray.600">
                {performance.company.description}
              </Text>
            </Box>
          )}
        </GridItem>

        {/* Upcoming Shows */}
        <GridItem
          colSpan={[4, 4]}
          order={3}
        >
          <Text fontWeight={'bold'} fontSize="lg" mb={3}>
            Upcoming Shows
          </Text>
          
          {performance.upcomingPerformances?.length ? (
            <VStack spacing={3} align="stretch">
              {performance.upcomingPerformances.map((show, index) => (
                <Box
                  key={index}
                  p={4}
                  borderWidth={1}
                  borderRadius="md"
                  bg={show.soldOut ? 'red.50' : 'green.50'}
                >
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="bold">
                        {new Date(show.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Text>
                      <Text fontSize="sm">
                        {show.time} at {show.venue?.name}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        {show.venue?.city}
                      </Text>
                    </VStack>
                    
                    <VStack>
                      {show.soldOut ? (
                        <Badge colorScheme="red">Sold Out</Badge>
                      ) : show.ticketUrl ? (
                        <Button
                          as="a"
                          href={show.ticketUrl}
                          target="_blank"
                          rel="noopener"
                          size="sm"
                          colorScheme="blue"
                        >
                          Get Tickets
                        </Button>
                      ) : (
                        <Text fontSize="xs" color="gray.500">No tickets yet</Text>
                      )}
                    </VStack>
                  </Flex>
                </Box>
              ))}
            </VStack>
          ) : (
            <Text color="gray.500">No upcoming shows scheduled</Text>
          )}
        </GridItem>

        {/* Venue Information */}
        <GridItem
          colSpan={[4, 4]}
          order={4}
        >
          <Tabs>
            <TabList>
              <Tab>Venues</Tab>
              <Tab>Details</Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <VStack spacing={3} align="stretch">
                  {performance.venues.map((venue, index) => (
                    <Box key={venue.id} p={3} borderWidth={1} borderRadius="md">
                      <Text fontWeight="bold">{venue.name}</Text>
                      <Text fontSize="sm" color="gray.600">{venue.address}</Text>
                      <Text fontSize="sm" color="gray.600">{venue.city}</Text>
                      
                      {venue.coordinates && (
                        <Button
                          as="a"
                          href={`https://maps.google.com/?q=${venue.coordinates.lat},${venue.coordinates.lng}`}
                          target="_blank"
                          size="xs"
                          mt={2}
                          variant="outline"
                        >
                          View on Map
                        </Button>
                      )}
                    </Box>
                  ))}
                </VStack>
              </TabPanel>

              <TabPanel px={0}>
                <VStack align="start" spacing={2}>
                  <Text><strong>Duration:</strong> {performance.duration} minutes</Text>
                  <Text><strong>Languages:</strong> {performance.languages?.join(', ')}</Text>
                  {performance.company.name && (
                    <Text><strong>Company:</strong> {performance.company.name}</Text>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>

        {/* Action Buttons */}
        <GridItem
          colSpan={[4, 4]}
          order={5}
        >
          <Divider my={4} />
          <HStack spacing={3} justify="center">
            <Button
              colorScheme="green"
              onClick={() => window.location.href = '/review/new?performance=' + performance.id}
            >
              Write a Review
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Back to Search
            </Button>
          </HStack>
        </GridItem>
      </Grid>
      
      <Footer />
    </Box>
  )
}