import {
    Text,
    Box,
    Button
  } from '@chakra-ui/react'
  import { useParams } from 'react-router-dom'
  import { Header } from '../../components/Header/Header'
  
  export const PerformanceDetails = () => {
    const { performanceId } = useParams()
  
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
        
        <Box p={8}>
          <Text fontSize="2xl" mb={4}>
            Performance Details
          </Text>
          <Text mb={4}>
            Performance ID: {performanceId}
          </Text>
          <Text mb={4} color="gray.600">
            (This page is under construction - we'll add GraphQL data soon!)
          </Text>
          <Button
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </Box>
      </Box>
    )
  }