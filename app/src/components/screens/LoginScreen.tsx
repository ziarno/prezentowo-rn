import { useFormik } from 'formik'
import { Link } from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native'
import * as Yup from 'yup'

import { useAuth } from '@/hooks/useAuth'

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().required('Required'),
})

export function LoginScreen() {
  const { signIn } = useAuth()

  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setErrors } =
    useFormik({
      initialValues: { email: '', password: '' },
      validationSchema,
      onSubmit: (values, { setSubmitting }) => {
        signIn({
          email: values.email,
          password: values.password,
          onError: err => {
            setErrors({ password: err.reason ?? err.error })
            setSubmitting(false)
          },
        })
      },
    })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Sign in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={values.email}
        onChangeText={handleChange('email')}
        onBlur={handleBlur('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {touched.email && errors.email && (
        <Text style={styles.error}>{errors.email}</Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={values.password}
        onChangeText={handleChange('password')}
        onBlur={handleBlur('password')}
        secureTextEntry
        textContentType="password"
      />
      {touched.password && errors.password && (
        <Text style={styles.error}>{errors.password}</Text>
      )}

      <Pressable style={styles.button} onPress={() => handleSubmit()} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <Link href="/register" style={styles.link}>
        Don't have an account? Register
      </Link>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 4,
    fontSize: 16,
  },
  error: {
    color: '#e53e3e',
    marginBottom: 8,
    fontSize: 13,
  },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 24,
    textAlign: 'center',
    color: '#208AEF',
  },
})
