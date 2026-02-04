// Import Link component from expo-router
// Link is used for navigation using declarative links (like <a> in web)
import { Link } from 'expo-router';

// Import StyleSheet to define styles in React Native
import { StyleSheet } from 'react-native';

// Import a custom themed text component
// This component automatically adapts to light/dark theme
import { ThemedText } from '@/components/themed-text';

// Import a custom themed view component
// This wraps a normal View but applies theme-aware background colors
import { ThemedView } from '@/components/themed-view';

// This is a screen component that will be shown as a modal
export default function ModalScreen() {
  return (
    // ThemedView acts like a normal View but respects app theme
    <ThemedView style={styles.container}>

      {/* Title text displayed inside the modal */}
      <ThemedText type="title">This is a modal</ThemedText>

      {/* 
        Link component for navigation
        href="/" means navigate to the home screen
        dismissTo means: close the modal and go to the target route
      */}
      <Link href="/" dismissTo style={styles.link}>

        {/* Styled link text */}
        <ThemedText type="link">Go to home screen</ThemedText>

      </Link>
    </ThemedView>
  );
}

// Styles used in this screen
const styles = StyleSheet.create({
  // Main container style
  container: {
    flex: 1,                 // Take full screen height
    alignItems: 'center',    // Center content horizontally
    justifyContent: 'center',// Center content vertically
    padding: 20,             // Add spacing around content
  },

  // Style for the link container
  link: {
    marginTop: 15,           // Space above the link
    paddingVertical: 15,     // Vertical padding for better touch area
  },
});
/*This file defines a modal screen component in a React Native app using Expo Router.
It uses themed components to adapt to light/dark modes and provides a link to navigate back to the home screen while dismissing the modal.
*/