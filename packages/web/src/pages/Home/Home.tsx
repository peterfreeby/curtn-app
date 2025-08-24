import {
  Flex,
  VStack,
  HStack,
  Button,
  Text
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { Main } from '../../components/Main/Main'
import { Header } from '../../components/Header/Header'
import { Greeting } from '../../components/Greeting/Greeting'
import { graphql, useLazyLoadQuery } from 'react-relay'

import type { HomeQuery } from './__generated__/HomeQuery.graphql'

export const Home = () => {
  const navigate = useNavigate()

  const data = useLazyLoadQuery<HomeQuery>(graphql`
    query HomeQuery {
      ...Greeting__user
      performanceList(first: 5) {
        edges {
          node {
            id
            title
            performanceTypes
            company {
              name
            }
            upcomingPerformances {
              date
              venue {
                name
                city
              }
            }
          }
        }
      }
    }
  `, {}, { fetchPolicy: 'store-and-network' })

  return (
    <VStack
      w={'100%'}
      h={'100%'}
      minH={'100vh'}
    >
      <Header />
      <Main>
        <Flex
          w={'100%'}
          gap={'1em'}
          direction={'column'}
        >
          <Greeting data={data} />
          
          {/* Performance List Section */}
          <VStack align="start" spacing={4} w="100%">
            <Text fontSize="xl" fontWeight="bold">
              Upcoming Performances
            </Text>
            
            {data.performanceList?.edges?.map((edge) => {
              if (!edge?.node) return null
              
              const performance = edge.node
              const nextShow = performance.upcomingPerformances?.[0]
              
              return (
                <Flex
                  key={performance.id}
                  p={4}
                  borderWidth={1}
                  borderRadius="md"
                  w="100%"
                  direction="column"
                  gap={2}
                  _hover={{ bg: 'gray.50' }}
                  cursor="pointer"
                  onClick={() => navigate(`/performance/${performance.id}`)}
                >
                  <Text fontWeight="bold" fontSize="lg">
                    {performance.title}
                  </Text>
                  
                  <Text color="gray.600">
                    by {performance.company.name}
                  </Text>
                  
                  <Flex gap={2} wrap="wrap">
                    {performance.performanceTypes.map((type, index) => (
                      <Text
                        key={index}
                        fontSize="sm"
                        bg="blue.100"
                        color="blue.800"
                        px={2}
                        py={1}
                        borderRadius="full"
                      >
                        {type}
                      </Text>
                    ))}
                  </Flex>
                  
                  {nextShow && (
                    <Text fontSize="sm" color="green.600" fontWeight="medium">
                      Next show: {new Date(nextShow.date).toLocaleDateString()} 
                      at {nextShow.venue?.name} ({nextShow.venue?.city})
                    </Text>
                  )}
                </Flex>
              )
            })}
          </VStack>

          <HStack
            w={'100%'}
            justifyContent={'flex-end'}
          >
            <Button
              onClick={() => {
                navigate('/review/new')
              }}
            >
              Review a Performance
            </Button>
          </HStack>
        </Flex>
      </Main>
    </VStack>
  )
}